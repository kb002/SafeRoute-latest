import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  ToastController,
  NavController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';

interface Contact {
  name: string;
  phoneNumber: string;
  relationship: string;
  createdAt?: any;
}

@Component({
  selector: 'app-add-contact',
  templateUrl: './add-contact.page.html',
  styleUrls: ['./add-contact.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption
  ]
})
export class AddContactPage {
  newContact: Contact = { name: '', phoneNumber: '', relationship: '' };
  phoneDigits: string = '';
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
    private navCtrl: NavController,
    private firestore: Firestore,
    private auth: Auth,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    if (this.newContact.phoneNumber && this.newContact.phoneNumber.startsWith('+63')) {
      this.phoneDigits = this.newContact.phoneNumber.replace(/^\+63/, '').slice(0, 10);
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  // Allow only numeric digits (0–9)
  allowNumbersOnly(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  // --- Real-time validation methods ---
  validateName() {
    const name = this.newContact.name?.trim() || '';
    if (!name) {
      this.errorMessages.name = 'Name is required.';
    } else {
      this.errorMessages.name = '';
    }
  }

  validatePhone() {
    const phone = this.newContact.phoneNumber;
    const pattern = /^\+639\d{9}$/;

    if (!phone) {
      this.errorMessages.phone = 'Phone number is required.';
    } else if (!pattern.test(phone)) {
      this.errorMessages.phone = 'Invalid number. Use format +639XXXXXXXXX.';
    } else {
      this.errorMessages.phone = '';
    }
  }

  validateRelationship() {
    if (!this.newContact.relationship) {
      this.errorMessages.relationship = 'Please select a relationship.';
    } else {
      this.errorMessages.relationship = '';
    }
  }

  onPhoneInput(event: any) {
    // Clean non-numeric input and keep only 10 digits
    const raw = event?.detail?.value ?? event?.target?.value ?? this.phoneDigits ?? '';
    const digits = String(raw).replace(/\D/g, '').slice(0, 10);
    this.phoneDigits = digits;
    this.newContact.phoneNumber = digits ? '+63' + digits : '';

    // Trigger validation while typing
    this.validatePhone();
  }

  async saveContact() {
    // Run all validations before saving
    this.validateName();
    this.validatePhone();
    this.validateRelationship();

    if (this.errorMessages.name || this.errorMessages.phone || this.errorMessages.relationship) return;

    const user = this.auth.currentUser;
    if (!user) {
      this.showToast('You must be logged in to add contacts', 'danger');
      return;
    }

    try {
      const contactsRef = collection(this.firestore, `users/${user.uid}/emergency_contacts`);
      await addDoc(contactsRef, {
        ...this.newContact,
        createdAt: serverTimestamp()
      });

      this.showToast('Contact added successfully', 'success');
      this.navCtrl.back();
    } catch {
      this.showToast('Failed to add contact', 'danger');
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
