import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { setupService } from '../services/setup.service';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isMain: boolean;
  active?: boolean;
  createdAt?: any;
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
          console.error('No company ID found for user');
          setLoading(false);
          return;
        }

        setCompanyId(cId);

        // Subscribe to branches collection
        const branchesRef = collection(db, 'companies', cId, 'branches');
        const q = query(branchesRef, where('active', '==', true));
        
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const branchList: Branch[] = [];
            snapshot.forEach((doc) => {
              branchList.push({
                id: doc.id,
                ...doc.data()
              } as Branch);
            });

            // Sort branches so main branch is first
            branchList.sort((a, b) => {
              if (a.isMain) return -1;
              if (b.isMain) return 1;
              return 0;
            });

            setBranches(branchList);

            // Set current branch
            if (branchList.length > 0) {
              // Try to restore previously selected branch
              const savedBranchId = localStorage.getItem(BRANCH_STORAGE_KEY);
              const savedBranch = branchList.find(b => b.id === savedBranchId);
              
              if (savedBranch) {
                setCurrentBranch(savedBranch);
              } else {
                // Default to main branch or first branch
                const mainBranch = branchList.find(b => b.isMain) || branchList[0];
                setCurrentBranch(mainBranch);
                localStorage.setItem(BRANCH_STORAGE_KEY, mainBranch.id);
              }
            }

            setLoading(false);
          },
          (error) => {
            console.error('Error loading branches:', error);
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