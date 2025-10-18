import { Injectable } from '@angular/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  constructor(private platform: Platform) {}

  async makeCall(phone: string) {
    const phoneClean = phone.replace(/\s+/g, '');

    try {
      if (this.platform.is('hybrid')) {
        // Opens the dialer app with the number ready
        await AppLauncher.openUrl({ url: `tel:${phoneClean}` });
        console.log('📞 Dialer opened successfully');
      } else {
        // Fallback for web
        window.open(`tel:${phoneClean}`, '_system');
        console.log('🌐 Fallback dialer opened');
      }
    } catch (error) {
      console.error('❌ Error opening dialer:', error);
      window.open(`tel:${phoneClean}`, '_system');
    }
  }
}
