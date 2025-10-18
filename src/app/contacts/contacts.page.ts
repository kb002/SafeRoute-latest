import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  IonicModule,
  NavController,
  ToastController,
  AlertController,
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData,
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { CallNumber } from '@awesome-cordova-plugins/call-number/ngx';

interface Contact {
  id?: string;
  name: string;
  email?: string;
  relationship?: string;
  phone?: string;
  createdAt?: any;
}

interface Hotline {
  id?: string;
  name: string;
  hotline: string;
}

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
  providers: [CallNumber],
})
export class ContactsPage implements OnInit, OnDestroy {
  user: User | null = null;
  contacts: Contact[] = [];
  adminHotlines: Hotline[] = [];
  loading = true;
  activeTab: 'contacts' | 'hotlines' = 'contacts'; // Default tab

  private authUnsub?: () => void;
  private contactsSub?: Subscription;
  private hotlinesSub?: Subscription;

  constructor(
    private navCtrl: NavController,
    private auth: Auth,
    private firestore: Firestore,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router,
    private callNumber: CallNumber
  ) {}

  ngOnInit() {
    this.authUnsub = onAuthStateChanged(this.auth, async (user) => {
      this.user = user;
      if (user) {
        await this.loadContacts(user.uid);
      }
      await this.loadAdminHotlines();
      this.loading = false;
    });
  }

  ngOnDestroy() {
    if (this.authUnsub) this.authUnsub();
    if (this.contactsSub) this.contactsSub.unsubscribe();
    if (this.hotlinesSub) this.hotlinesSub.unsubscribe();
  }

  switchTab(tab: 'contacts' | 'hotlines') {
    this.activeTab = tab;
  }

  private async loadContacts(uid: string) {
    try {
      const contactsRef = collection(this.firestore, `users/${uid}/emergency_contacts`);
      this.contactsSub = collectionData(contactsRef, { idField: 'id' }).subscribe(
        (data: any[]) => {
          this.contacts = data.map((doc) => ({
            id: doc.id,
            name: doc.name || 'Unnamed Contact',
            email: doc.email || '',
            relationship: doc.relationship || '',
            phone: doc.phone || doc.phoneNumber || doc.contactNumber || '',
            createdAt: doc.createdAt || null,
          }));
        },
        () => this.showToast('Failed to load contacts', 'danger')
      );
    } catch {
      this.showToast('Failed to load contacts', 'danger');
    }
  }

  private async loadAdminHotlines() {
    try {
      const hotlinesRef = collection(this.firestore, `emergency_hotlines`);
      this.hotlinesSub = collectionData(hotlinesRef, { idField: 'id' }).subscribe(
        (data: any[]) => {
          this.adminHotlines = data.map((doc) => ({
            id: doc.id,
            name: doc.name || 'Unnamed Hotline',
            hotline: doc.hotline || '',
          }));
        },
        () => this.showToast('Failed to load hotlines', 'danger')
      );
    } catch {
      this.showToast('Failed to load hotlines', 'danger');
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  viewContact(contact: Contact) {
    if (contact.id) {
      this.navCtrl.navigateForward(['/view-contacts', contact.id, { type: 'user' }]);
    }
  }

  viewHotline(hotline: Hotline) {
    if (hotline.id) {
      this.navCtrl.navigateForward(['/view-contacts', hotline.id, { type: 'hotline' }]);
    }
  }

  async addContact() {
    if (!this.user) {
      this.showToast('You must be logged in to add contacts', 'danger');
      return;
    }

    if (this.contacts.length >= 3) {
      this.showToast('You can have a maximum of 3 Emergency Contacts', 'warning');
      return;
    }

    this.navCtrl.navigateForward(['/add-contact']);
  }

  async confirmCall(number: string | undefined, name: string) {
    const alert = await this.alertCtrl.create({
      header: 'Call Contact',
      message: `Do you want to call ${name}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Call',
          handler: () => this.makeCall(number),
        },
      ],
    });
    await alert.present();
  }

  private async makeCall(number?: string) {
    const rawPhone = number?.toString().trim();
    if (!rawPhone) {
      this.showToast('This contact has no phone number', 'danger');
      return;
    }

    let phoneNumber = rawPhone.startsWith('+63')
      ? rawPhone
      : rawPhone.startsWith('0')
      ? '+63' + rawPhone.slice(1)
      : '+63' + rawPhone;

    try {
      await this.callNumber.callNumber(phoneNumber, true);
    } catch (err) {
      console.error('Error calling number:', err);
      this.showToast('Failed to start the call', 'danger');
    }
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
