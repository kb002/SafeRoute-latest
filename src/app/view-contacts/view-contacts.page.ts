import { Component, OnInit } from '@angular/core';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';

interface Contact {
  id?: string;
  name: string;
  email: string;
  relationship: string;
  createdAt?: any;
}

@Component({
  selector: 'app-view-contacts',
  templateUrl: './view-contacts.page.html',
  styleUrls: ['./view-contacts.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ViewContactsPage implements OnInit {
  contactId: string | null = null;
  contact: Contact | null = null;
  loading = true;

  // Modal state
  isEditModalOpen = false;
  editData: Contact = { name: '', email: '', relationship: '' };

  // Predefined relationship options
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
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.contactId = this.route.snapshot.paramMap.get('id');

    // Wait for Firebase Auth to restore user session
    onAuthStateChanged(this.auth, async (user: User | null) => {
      if (user && this.contactId) {
        await this.loadContact(user.uid, this.contactId);
      } else {
        this.loading = false;
      }
    });
  }

  async loadContact(uid: string, contactId: string) {
    try {
      const contactRef = doc(this.firestore, `users/${uid}/emergency_contacts/${contactId}`);
      const contactSnap = await getDoc(contactRef);
      if (contactSnap.exists()) {
        this.contact = contactSnap.data() as Contact;
        this.contact.id = contactSnap.id;
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

  goBack() {
    this.navCtrl.back();
  }

  editContact() {
    if (this.contact) {
      this.editData = { ...this.contact };
      this.isEditModalOpen = true;
    }
  }

  cancelEdit() {
    this.isEditModalOpen = false;
  }

  async saveEdit() {
    const user = this.auth.currentUser;
    if (!user || !this.contactId) return;

    // ✅ Validation
    if (!this.editData.name || !this.editData.email || !this.editData.relationship) {
      this.showToast('All fields are required', 'warning');
      return;
    }

    // ✅ Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.editData.email)) {
      this.showToast('Please enter a valid email address', 'warning');
      return;
    }

    try {
      const contactRef = doc(this.firestore, `users/${user.uid}/emergency_contacts/${this.contactId}`);
      await updateDoc(contactRef, {
        name: this.editData.name,
        email: this.editData.email,
        relationship: this.editData.relationship,
      });

      this.contact = { ...this.editData };
      this.isEditModalOpen = false;

      this.showToast('Contact updated successfully', 'success');
    } catch (err) {
      console.error('Error updating contact:', err);
      this.showToast('Failed to update contact', 'danger');
    }
  }

  async confirmDelete() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Contact',
      message: 'Do you really want to delete this contact?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.deleteContact();
          },
        },
      ],
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

  // Toast helper
  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
