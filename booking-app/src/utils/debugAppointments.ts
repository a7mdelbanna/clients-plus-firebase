import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function debugAppointments(companyId: string, phoneNumber: string) {
  console.log('=== DEBUG APPOINTMENTS ===');
  console.log('Company ID:', companyId);
  console.log('Phone Number:', phoneNumber);
  
  let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
  
  // If the normalized phone doesn't start with 0, add it (Egyptian format)
  if (normalizedPhone && !normalizedPhone.startsWith('0')) {
    normalizedPhone = '0' + normalizedPhone;
  }
  
  console.log('Normalized Phone:', normalizedPhone);
  
  try {
    // Query 1: Get sample appointments for company
    console.log('\n--- Sample appointments for company ---');
    const q1 = query(
      collection(db, 'appointments'),
      where('companyId', '==', companyId),
      limit(5)
    );
    const snapshot1 = await getDocs(q1);
    console.log('Found', snapshot1.size, 'appointments');
    snapshot1.forEach(doc => {
      const data = doc.data();
      console.log('Appointment:', {
        id: doc.id,
        clientPhone: data.clientPhone,
        clientId: data.clientId,
        clientName: data.clientName,
        date: data.date?.toDate?.() || data.date,
        status: data.status
      });
    });
    
    // Query 2: Search by exact phone
    console.log('\n--- Appointments by exact phone ---');
    const q2 = query(
      collection(db, 'appointments'),
      where('companyId', '==', companyId),
      where('clientPhone', '==', phoneNumber),
      limit(5)
    );
    const snapshot2 = await getDocs(q2);
    console.log('Found with original phone:', snapshot2.size);
    
    // Query 3: Search by normalized phone
    console.log('\n--- Appointments by normalized phone ---');
    const q3 = query(
      collection(db, 'appointments'),
      where('companyId', '==', companyId),
      where('clientPhone', '==', normalizedPhone),
      limit(5)
    );
    const snapshot3 = await getDocs(q3);
    console.log('Found with normalized phone:', snapshot3.size);
    snapshot3.forEach(doc => {
      const data = doc.data();
      console.log('- Date:', data.date?.toDate?.() || data.date, 'Services:', data.services);
    });
    
    // Query 4: Get all unique client phones in appointments
    console.log('\n--- Unique client phones in appointments ---');
    const q4 = query(
      collection(db, 'appointments'),
      where('companyId', '==', companyId),
      limit(20)
    );
    const snapshot4 = await getDocs(q4);
    const uniquePhones = new Set<string>();
    snapshot4.forEach(doc => {
      const phone = doc.data().clientPhone;
      if (phone) uniquePhones.add(phone);
    });
    console.log('Unique phones:', Array.from(uniquePhones));
    
  } catch (error) {
    console.error('Debug error:', error);
  }
  
  console.log('=== END DEBUG ===');
}

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).debugAppointments = debugAppointments;
}