import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BottomNavComponent } from '../components/bottom-nav/bottom-nav.component';
import { Firestore, collection, getDocs, query, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CallNumber } from '@awesome-cordova-plugins/call-number/ngx';

@Component({
  selector: 'app-sos',
  templateUrl: './sos.page.html',
  styleUrls: ['./sos.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, BottomNavComponent],
  providers: [CallNumber],
})
export class SosPage implements OnInit, OnDestroy {
  username = 'Guest';
  private sub?: Subscription;
  private clickCount = 0;
  private clickTimeout: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private firestore: Firestore,
    private auth: Auth,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private callNumber: CallNumber
  ) {}

  ngOnInit() {
    this.sub = this.authService.username$.subscribe({
      next: (name) => {
        this.username = name?.trim().length ? name : 'Guest';
      },
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToContacts() {
    this.router.navigate(['/contacts']);
  }

  // --- Handle triple-tap SOS button ---
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
      console.log('Triple tap detected — showing contact options');
      await this.callEmergencyContact();
    }
  }

  // --- Fetch and choose contact to call ---
  private async callEmergencyContact() {
    const user = this.auth.currentUser;
    if (!user) {
      const alert = await this.alertCtrl.create({
        header: 'Not Logged In',
        message: 'Please log in before using SOS.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const uid = user.uid;
    const contactsRef = collection(this.firestore, `users/${uid}/emergency_contacts`);
    const q = query(contactsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const alert = await this.alertCtrl.create({
        header: 'No Emergency Contacts',
        message: 'You need to add at least one emergency contact before using SOS.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Add',
            handler: () => this.router.navigate(['/add-contact']),
          },
        ],
      });
      await alert.present();
      return;
    }

    const contacts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    // --- If only one contact, call directly ---
    if (contacts.length === 1) {
      const singleContact = contacts[0];
      const phone = String(singleContact.phoneNumber || '').replace(/\s+/g, '');
      await this.makeCall(phone);
      return;
    }

    // --- If multiple contacts, show selection alert ---
    const alert = await this.alertCtrl.create({
      header: 'Choose Emergency Contact',
      message: 'Select the contact you want to call:',
      buttons: [
        ...contacts.map((c) => ({
          text: `${c.name} (${c.relationship || 'Contact'})`,
          handler: async () => {
            const phone = String(c.phoneNumber || '').replace(/\s+/g, '');
            await this.makeCall(phone);
          },
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });

    await alert.present();
  }

  // --- Make the phone call safely ---
  private async makeCall(phone: string) {
    if (!phone) {
      const alert = await this.alertCtrl.create({
        header: 'Invalid Contact',
        message: 'This contact has no valid phone number.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    console.log(`Attempting to call: ${phone}`);
    try {
      await this.callNumber.callNumber(phone, true);
      console.log('Call initiated successfully');
    } catch (error) {
      console.error('Failed to call:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to start call. Please check call permissions.',
        duration: 2000,
        color: 'danger',
        position: 'middle',
      });
      await toast.present();
    }
  }
}
