import { Component, OnInit } from '@angular/core';
import {
  IonicModule,
  NavController,
  ToastController,
  AlertController
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';
import { CallNumber } from '@awesome-cordova-plugins/call-number/ngx';

interface Contact {
  id?: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
  createdAt?: any;
}

@Component({
  selector: 'app-view-contacts',
  templateUrl: './view-contacts.page.html',
  styleUrls: ['./view-contacts.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  providers: [CallNumber]
})
export class ViewContactsPage implements OnInit {
  contactId: string | null = null;
  contact: Contact | null = null;
  loading = true;
  isHotline = false;

  isEditModalOpen = false;
  editData: Contact = { name: '', phoneNumber: '', relationship: '' };

  errorMessages = { name: '', phone: '', relationship: '' };

  relationshipOptions: string[] = [
    'Mother',
    'Father',
    'Sibling',
    'Relative',
    'Friend',
    'Spouse',
    'Guardian'
  ];

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private firestore: Firestore,
    private auth: Auth,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private callNumberService: CallNumber
  ) {}

  ngOnInit() {
    this.contactId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.paramMap.get('type');
    this.isHotline = type === 'hotline';

    if (this.isHotline) {
      this.loadHotline(this.contactId!);
    } else {
      onAuthStateChanged(this.auth, async (user: User | null) => {
        if (user && this.contactId) {
          await this.loadContact(user.uid, this.contactId);
        } else {
          this.loading = false;
        }
      });
    }
  }

  async loadContact(uid: string, contactId: string) {
    try {
      const contactRef = doc(this.firestore, `users/${uid}/emergency_contacts/${contactId}`);
      const contactSnap = await getDoc(contactRef);
      if (contactSnap.exists()) {
        const data = contactSnap.data() as Contact;
        const localNumber = data.phoneNumber?.startsWith('+63')
          ? data.phoneNumber.substring(3)
          : data.phoneNumber;
        this.contact = { id: contactSnap.id, ...data };
        this.editData.phoneNumber = localNumber;
      } else {
        this.contact = null;
      }
    } catch (err) {
      console.error('Error fetching contact:', err);
      this.contact = null;
    } finally {
      this.loading = false;
    }
  }

  async loadHotline(hotlineId: string) {
    try {
      const hotlineRef = doc(this.firestore, `emergency_hotlines/${hotlineId}`);
      const hotlineSnap = await getDoc(hotlineRef);
      if (hotlineSnap.exists()) {
        const data = hotlineSnap.data() as any;
        const hotlineNumber = this.formatPhoneNumber(data.hotline);
        this.contact = {
          id: hotlineSnap.id,
          name: data.name || 'Unknown Hotline',
          phoneNumber: hotlineNumber
        };
      } else {
        this.contact = null;
      }
    } catch (err) {
      console.error('Error fetching hotline:', err);
      this.contact = null;
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  formatPhoneNumber(number: string): string {
    if (!number) return 'N/A';
    number = number.replace(/\s+/g, '');
    if (number.startsWith('+63')) return number;
    if (number.startsWith('09')) return '+63' + number.substring(1);
    return number;
  }

  async callNumber(phoneNumber: string) {
    const formatted = this.formatPhoneNumber(phoneNumber);
    try {
      await this.callNumberService.callNumber(formatted, true);
    } catch {
      this.showToast('Failed to start call', 'danger');
    }
  }

  editContact() {
    if (this.contact && !this.isHotline) {
      const localNum = this.contact.phoneNumber?.startsWith('+63')
        ? this.contact.phoneNumber.substring(3)
        : this.contact.phoneNumber;

      this.editData = {
        name: this.contact.name,
        phoneNumber: localNum,
        relationship: this.contact.relationship || ''
      };
      this.isEditModalOpen = true;
      this.errorMessages = { name: '', phone: '', relationship: '' };
    }
  }

  cancelEdit() {
    this.isEditModalOpen = false;
  }

  onPhoneInput(event: any) {
    const raw = event?.detail?.value ?? '';
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    this.editData.phoneNumber = digits;
  }

  validateName() {
    const name = this.editData.name?.trim() || '';
    if (!name) this.errorMessages.name = 'Name is required.';
    else this.errorMessages.name = '';
  }

  validatePhone() {
    const phone = this.editData.phoneNumber?.trim() || '';
    const pattern = /^9\d{9}$/;
    if (!phone) this.errorMessages.phone = 'Phone number is required.';
    else if (!pattern.test(phone))
      this.errorMessages.phone = 'Invalid number. Use format 9XXXXXXXXX.';
    else this.errorMessages.phone = '';
  }

  validateRelationship() {
    if (!this.editData.relationship)
      this.errorMessages.relationship = 'Please select a relationship.';
    else this.errorMessages.relationship = '';
  }

  async saveEdit() {
    this.validateName();
    this.validatePhone();
    this.validateRelationship();

    if (this.errorMessages.name || this.errorMessages.phone || this.errorMessages.relationship) {
      return;
    }

    const user = this.auth.currentUser;
    if (!user || !this.contactId) return;

    const fullNumber = '+63' + this.editData.phoneNumber;

    try {
      const contactRef = doc(this.firestore, `users/${user.uid}/emergency_contacts/${this.contactId}`);
      await updateDoc(contactRef, {
        name: this.editData.name.trim(),
        phoneNumber: fullNumber,
        relationship: this.editData.relationship
      });

      this.contact = { ...this.editData, phoneNumber: fullNumber };
      this.isEditModalOpen = false;

      this.showToast('Contact updated successfully', 'success');
    } catch (err) {
      console.error('Error updating contact:', err);
      this.showToast('Failed to update contact', 'danger');
    }
  }

  async confirmDelete() {
    if (this.isHotline) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete Contact',
      message: 'Do you really want to delete this contact?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteContact()
        }
      ]
    });
    await alert.present();
  }

  private async deleteContact() {
    const user = this.auth.currentUser;
    if (!user || !this.contactId) return;

    try {
      await deleteDoc(doc(this.firestore, `users/${user.uid}/emergency_contacts/${this.contactId}`));
      this.showToast('Contact deleted successfully', 'success');
      this.navCtrl.back();
    } catch (err) {
      console.error('Error deleting contact:', err);
      this.showToast('Failed to delete contact', 'danger');
    }
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
