import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { setupService } from '../services/setup.service';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  type?: 'main' | 'secondary';
  status?: 'active' | 'inactive';
  isMain?: boolean; // For backward compatibility
  active?: boolean; // For backward compatibility
  createdAt?: any;
  businessName?: string; // Business name from company document
}

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  loading: boolean;
  switchBranch: (branchId: string) => void;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};

interface BranchProviderProps {
  children: ReactNode;
}

const BRANCH_STORAGE_KEY = 'selectedBranchId';

export const BranchProvider: React.FC<BranchProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Load branches from Firestore
  useEffect(() => {
    if (!currentUser) {
      setBranches([]);
      setCurrentBranch(null);
      setLoading(false);
      return;
    }

    let unsubscribe: Unsubscribe | null = null;

    const loadBranches = async () => {
      try {
        // Get company ID
        const idTokenResult = await currentUser.getIdTokenResult();
        let cId = idTokenResult.claims.companyId as string;
        
        if (!cId) {
          cId = await setupService.getUserCompanyId(currentUser.uid);
        }

        if (!cId) {
          console.error('[BranchContext] No company ID found for user', {
            userId: currentUser.uid,
            claims: idTokenResult.claims,
            email: currentUser.email
          });
          setLoading(false);
          return;
        }

        setCompanyId(cId);

        // Subscribe to branches collection
        const branchesRef = collection(db, 'companies', cId, 'branches');
        // Get ALL branches, we'll filter inactive ones in the client
        // This ensures branches without status field are still loaded
        const q = query(branchesRef);
        
        unsubscribe = onSnapshot(
          q,
          async (snapshot) => {
            const branchList: Branch[] = [];
            
            // Get business name from company document
            let businessName = '';
            try {
              const companyDoc = await getDoc(doc(db, 'companies', cId));
              if (companyDoc.exists()) {
                businessName = companyDoc.data().businessName || '';
              }
            } catch (error) {
              console.warn('Could not fetch business name:', error);
            }
            
            snapshot.forEach((doc) => {
              const data = doc.data();
              // Include branch if:
              // 1. It has status: 'active'
              // 2. It has active: true
              // 3. It has no status field (legacy branches)
              // 4. It's the main branch (type: 'main' or isMain: true)
              
              const isMainBranch = data.type === 'main' || data.isMain === true;
              const hasActiveStatus = data.status === 'active';
              const hasActiveField = data.active === true;
              const hasNoStatus = data.status === undefined && data.active === undefined;
              
              if (isMainBranch || hasActiveStatus || hasActiveField || hasNoStatus) {
                branchList.push({
                  id: doc.id,
                  ...data,
                  businessName,
                  // Ensure compatibility fields
                  isMain: isMainBranch,
                  active: hasActiveStatus || hasActiveField || hasNoStatus
                } as Branch);
              }
            });

            // Sort branches so main branch is first
            branchList.sort((a, b) => {
              // Check both isMain and type for backward compatibility
              const aIsMain = a.isMain || a.type === 'main';
              const bIsMain = b.isMain || b.type === 'main';
              
              if (aIsMain) return -1;
              if (bIsMain) return 1;
              return 0;
            });

            setBranches(branchList);
            
            console.log('[BranchContext] Loaded branches:', branchList.map(b => ({
              id: b.id,
              name: b.name,
              type: b.type,
              status: b.status
            })));

            // Set current branch
            if (branchList.length > 0) {
              // Try to restore previously selected branch
              const savedBranchId = localStorage.getItem(BRANCH_STORAGE_KEY);
              console.log('[BranchContext] Saved branch ID:', savedBranchId);
              
              const savedBranch = branchList.find(b => b.id === savedBranchId);
              
              if (savedBranch) {
                console.log('[BranchContext] Found saved branch:', savedBranch.name);
                setCurrentBranch(savedBranch);
              } else {
                // Default to main branch or first branch
                const mainBranch = branchList.find(b => b.isMain || b.type === 'main') || branchList[0];
                console.log('[BranchContext] Using default branch:', mainBranch?.name);
                setCurrentBranch(mainBranch);
                localStorage.setItem(BRANCH_STORAGE_KEY, mainBranch.id);
              }
            } else {
              console.warn('[BranchContext] No branches loaded!');
            }

            setLoading(false);
          },
          (error) => {
            console.error('[BranchContext] Error loading branches:', {
              error: error.message,
              code: error.code,
              companyId: cId,
              userId: currentUser.uid
            });
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error in loadBranches:', error);
        setLoading(false);
      }
    };

    loadBranches();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  const switchBranch = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setCurrentBranch(branch);
      localStorage.setItem(BRANCH_STORAGE_KEY, branchId);
    }
  };

  const refreshBranches = async () => {
    // This will trigger a re-fetch through the snapshot listener
    // The actual refresh happens automatically via onSnapshot
    setLoading(true);
  };

  const value: BranchContextType = {
    branches,
    currentBranch,
    loading,
    switchBranch,
    refreshBranches,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};