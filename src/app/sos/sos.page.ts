import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  NavController,
  LoadingController,
  ToastController
} from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BottomNavComponent } from '../components/bottom-nav/bottom-nav.component';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-sos',
  templateUrl: './sos.page.html',
  styleUrls: ['./sos.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, BottomNavComponent]
})
export class SosPage implements OnInit, OnDestroy {
  username = 'Guest';
  private sub?: Subscription;

  private clickCount = 0;
  private clickTimeout: any;

  // ✅ EmailJS REST API credentials
  private EMAILJS_SERVICE_ID = 'service_2a2ye9s';
  private EMAILJS_TEMPLATE_ID = 'template_tvd3iv9';
  private EMAILJS_PUBLIC_KEY = 'yivsGi1tzi_-4fiw8';

  constructor(
    private authService: AuthService,
    private router: Router,
    private navCtrl: NavController,
    private firestore: Firestore,
    private auth: Auth,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private locationService: LocationService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    console.log('🚨 SOS Page initialized with EmailJS REST API');
    this.sub = this.authService.username$.subscribe({
      next: (name) => {
        this.username = name && name.trim().length > 0 ? name : 'Guest';
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  async goToContacts() {
    this.router.navigate(['/contacts']);
  }

  // ✅ Triple-click SOS trigger
  async handleSosClick() {
    this.clickCount++;

    if (this.clickCount === 1) {
      this.clickTimeout = setTimeout(() => {
        this.clickCount = 0;
      }, 1500);
    }

    if (this.clickCount === 3) {
      clearTimeout(this.clickTimeout);
      this.clickCount = 0;

      const toast = await this.toastCtrl.create({
        message: '🚨 SOS triggered!',
        duration: 1500,
        color: 'danger',
        position: 'middle',
        cssClass: 'sos-toast'
      });
      await toast.present();

      console.log('🚨 SOS button triple-click detected');
      await this.checkEmergencyContacts();
    }
  }

  // ✅ Check emergency contacts in Firestore
  private async checkEmergencyContacts() {
    console.log('👀 Checking emergency contacts...');

    if (!this.auth.currentUser) {
      console.warn('⚠️ No logged-in user found');
      const alert = await this.alertCtrl.create({
        header: 'Not Logged In',
        message: 'Please log in before triggering SOS.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const uid = this.auth.currentUser.uid;
    const contactsRef = collection(this.firestore, `users/${uid}/emergency_contacts`);
    const snapshot = await getDocs(contactsRef);

    if (snapshot.empty) {
      console.log('⚠️ No emergency contacts found');
      const alert = await this.alertCtrl.create({
        header: 'No Contacts',
        message: 'You need to add at least one emergency contact before using SOS.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const contacts = snapshot.docs.map(doc => doc.data());
    console.log('📡 Found contacts:', contacts);
    await this.sendSosToContacts(contacts);
  }

  // ✅ Send SOS email via EmailJS REST API (works on mobile)
  private async sendSosToContacts(contacts: any[]) {
    const loading = await this.loadingCtrl.create({
      message: 'Sending SOS...',
      spinner: 'crescent',
      cssClass: 'sos-loading'
    });
    await loading.present();

    try {
      const location = await this.locationService.getCurrentLocation();

      if (!location) {
        await loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Location Error',
          message: 'Unable to fetch your location. Please check location permissions.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      const mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
      const message = `🚨 SOS Alert from ${this.username}! I need help.\nMy current location: ${mapsUrl}`;

      const sendPromises = contacts.map(async (contact) => {
        const email = contact['email'];
        if (!email) return;

        console.log(`📤 Sending SOS email to ${email}...`);

        const payload = {
          service_id: this.EMAILJS_SERVICE_ID,
          template_id: this.EMAILJS_TEMPLATE_ID,
          user_id: this.EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: email,
            from_name: this.username,
            message: message
          }
        };

        try {
          const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            console.log('✅ Email sent successfully to', email);
            const successToast = await this.toastCtrl.create({
              message: `✅ Sent to ${email}`,
              duration: 1500,
              color: 'success',
              position: 'middle'
            });
            await successToast.present();
          } else {
            console.error('❌ Failed sending to', email, response.status);
            const failToast = await this.toastCtrl.create({
              message: `❌ Failed for ${email}`,
              duration: 1500,
              color: 'danger',
              position: 'middle'
            });
            await failToast.present();
          }
        } catch (err) {
          console.error('❌ Network or fetch error for', email, err);
          const failToast = await this.toastCtrl.create({
            message: `❌ Network error for ${email}`,
            duration: 1500,
            color: 'danger',
            position: 'middle'
          });
          await failToast.present();
        }
      });

      await Promise.all(sendPromises);
      await loading.dismiss();

      const doneAlert = await this.alertCtrl.create({
        header: 'SOS Sent',
        message: 'Emergency emails have been sent to your contacts.',
        buttons: ['OK']
      });
      await doneAlert.present();

    } catch (err) {
      console.error('❌ SOS sending failed:', err);
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to send SOS. Please check your internet connection.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }
}
