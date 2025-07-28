import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function debugClientLookup(phoneNumber: string, companyId: string) {
  console.log('=== DEBUG CLIENT LOOKUP ===');
  console.log('Original phone:', phoneNumber);
  console.log('Company ID:', companyId);
  
  // Try different phone formats
  let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
  
  // If the normalized phone doesn't start with 0, add it (Egyptian format)
  if (normalizedPhone && !normalizedPhone.startsWith('0')) {
    normalizedPhone = '0' + normalizedPhone;
  }
  
  const phoneWithCountry = phoneNumber.startsWith('+') ? phoneNumber : `+20${phoneNumber}`;
  const phoneWithoutPlus = phoneNumber.replace(/^\+/, '');
  
  console.log('Normalized phone:', normalizedPhone);
  console.log('Phone with country:', phoneWithCountry);
  console.log('Phone without plus:', phoneWithoutPlus);
  
  try {
    // Query 1: Normalized phone with company
    console.log('\n--- Query 1: Normalized phone with company ---');
    const q1 = query(
      collection(db, 'clients'),
      where('companyId', '==', companyId),
      where('phone', '==', normalizedPhone)
    );
    const snapshot1 = await getDocs(q1);
    console.log('Results:', snapshot1.size);
    snapshot1.forEach(doc => {
      console.log('Client:', doc.id, doc.data());
    });
    
    // Query 2: Original phone with company
    console.log('\n--- Query 2: Original phone with company ---');
    const q2 = query(
      collection(db, 'clients'),
      where('companyId', '==', companyId),
      where('phone', '==', phoneNumber)
    );
    const snapshot2 = await getDocs(q2);
    console.log('Results:', snapshot2.size);
    snapshot2.forEach(doc => {
      console.log('Client:', doc.id, doc.data());
    });
    
    // Query 3: Just phone (normalized)
    console.log('\n--- Query 3: Just normalized phone (no company) ---');
    const q3 = query(
      collection(db, 'clients'),
      where('phone', '==', normalizedPhone)
    );
    const snapshot3 = await getDocs(q3);
    console.log('Results:', snapshot3.size);
    snapshot3.forEach(doc => {
      const data = doc.data();
      console.log('Client:', doc.id, 'Company:', data.companyId, 'Phone:', data.phone);
    });
    
    // Query 4: All clients for company
    console.log('\n--- Query 4: All clients for company ---');
    const q4 = query(
      collection(db, 'clients'),
      where('companyId', '==', companyId)
    );
    const snapshot4 = await getDocs(q4);
    console.log('Total clients in company:', snapshot4.size);
    console.log('First 5 client phones:');
    snapshot4.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log('- Phone:', data.phone, 'Name:', data.name || data.firstName);
    });
    
  } catch (error) {
    console.error('Debug error:', error);
  }
  
  console.log('=== END DEBUG ===');
}

// Make it available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).debugClientLookup = debugClientLookup;
}