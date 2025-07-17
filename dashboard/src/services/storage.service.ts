import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

export const storageService = {
  async uploadCompanyLogo(
    file: File,
    companyId: string
  ): Promise<string> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const filename = `logo_${timestamp}.${extension}`;
      const storageRef = ref(storage, `companies/${companyId}/logo/${filename}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error: any) {
      console.error('Error uploading company logo:', error);
      
      // Provide more specific error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('غير مصرح لك برفع الشعار. يرجى تسجيل الدخول مرة أخرى.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('تم إلغاء رفع الشعار');
      } else if (error.code === 'storage/unknown') {
        throw new Error('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
      } else {
        throw new Error('حدث خطأ في رفع الشعار. يرجى المحاولة مرة أخرى.');
      }
    }
  },

  async uploadServiceImage(
    companyId: string,
    serviceId: string,
    file: File,
    imageName?: string
  ): Promise<string> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const filename = imageName || `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `companies/${companyId}/services/${serviceId}/${filename}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error: any) {
      console.error('Error uploading service image:', error);
      
      // Provide more specific error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('غير مصرح لك برفع الصور. يرجى تسجيل الدخول مرة أخرى.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('تم إلغاء رفع الصورة');
      } else if (error.code === 'storage/unknown') {
        throw new Error('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
      } else if (error.code === 'storage/object-not-found') {
        throw new Error('الملف غير موجود');
      } else if (error.message?.includes('CORS')) {
        throw new Error('خطأ في إعدادات CORS. يرجى الاتصال بالدعم الفني.');
      } else {
        throw new Error('حدث خطأ في رفع الصورة. يرجى المحاولة مرة أخرى.');
      }
      
      throw error;
    }
  },

  async deleteServiceImage(imageUrl: string): Promise<void> {
    try {
      // Extract the path from the URL
      const decodedUrl = decodeURIComponent(imageUrl);
      const pathMatch = decodedUrl.match(/\/o\/(.*?)\?/);
      
      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1];
        const imageRef = ref(storage, path);
        await deleteObject(imageRef);
      }
    } catch (error) {
      console.error('Error deleting service image:', error);
      // Don't throw error as image might already be deleted
    }
  },

  async uploadMultipleServiceImages(
    companyId: string,
    serviceId: string,
    files: File[]
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map(file => 
        this.uploadServiceImage(companyId, serviceId, file)
      );
      
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      console.error('Error uploading multiple service images:', error);
      throw error;
    }
  }
};