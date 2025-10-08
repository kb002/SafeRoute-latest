import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { 
  Auth, 
  onAuthStateChanged, 
  User, 
  signOut, 
  updateProfile, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  getDoc, 
  updateDoc 
} from '@angular/fire/firestore';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  address: string | null = null;
  phone: string | null = null;
  loading = true;
  isEditModalOpen = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showPasswordFields = false;
  private authUnsub?: () => void;

  editValues: any = { username: '', phone: '', address: '', password: '', currentPassword: '' };

  constructor(
    public navCtrl: NavController,
    private auth: Auth,
    private firestore: Firestore,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.authUnsub = onAuthStateChanged(this.auth, async (user) => {
      this.user = user;
      if (user) {
        await this.loadUserData(user.uid);
        this.editValues.username = user.displayName || '';
      } else {
        this.address = null;
        this.phone = null;
      }
      this.loading = false;
    });
  }

  ngOnDestroy() {
    if (this.authUnsub) this.authUnsub();
  }

  private async loadUserData(uid: string) {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        this.phone = data['phone'] || "No Phone";
        this.editValues.phone = this.phone !== "No Phone" ? this.phone : '';

        this.address = data['address'] || "No Address";
        this.editValues.address = this.address !== "No Address" ? this.address : '';

        if (data['username']) {
          this.editValues.username = data['username'];
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }

  openEditModal() {
    this.editValues.username = this.user?.displayName || '';
    this.editValues.phone = this.phone || '';
    this.editValues.address = this.address || '';
    this.editValues.password = '';
    this.editValues.currentPassword = '';
    this.showNewPassword = false;
    this.showCurrentPassword = false;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
  }

    async saveAllEdits() {
    if (!this.user) return;
    const uid = this.user.uid;
    const userRef = doc(this.firestore, `users/${uid}`);

    try {
      // Username validation
      if (!this.editValues.username || this.editValues.username.length < 3) {
        return this.showToast('Username must be at least 3 characters', 'warning');
      }
      await updateProfile(this.user, { displayName: this.editValues.username });
      await updateDoc(userRef, { username: this.editValues.username });

      // Phone validation (+63 followed by 10 digits)
      const phoneRegex = /^\+63\d{10}$/;
      if (!phoneRegex.test(this.editValues.phone)) {
        return this.showToast('Phone must be in format +63XXXXXXXXXX (10 digits after +63)', 'warning');
      }
      await updateDoc(userRef, { phone: this.editValues.phone });
      this.phone = this.editValues.phone;

      // Address validation
      if (!this.editValues.address) {
        return this.showToast('Please enter your address', 'warning');
      }
      await updateDoc(userRef, { address: this.editValues.address });
      this.address = this.editValues.address;

      // Password update
      if (this.editValues.password) {
        if (!this.editValues.currentPassword) {
          return this.showToast('Please enter your current password to change password.', 'warning');
        }

        try {
          const credential = EmailAuthProvider.credential(
            this.user.email!,
            this.editValues.currentPassword
          );
          await reauthenticateWithCredential(this.user, credential);

          if (this.editValues.password.length < 6) {
            return this.showToast('New password must be at least 6 characters', 'warning');
          }

          await updatePassword(this.user, this.editValues.password);
          this.showToast('Password updated successfully', 'success');

        } catch (err: any) {
          if (err.code === 'auth/wrong-password') {
            return this.showToast('Current password is incorrect.', 'danger');
          }
          console.error('Error updating password:', err);
          return this.showToast('Password update failed. Try again.', 'danger');
        }
      }

      this.showToast('Profile updated successfully', 'success');
      this.closeEditModal();

    } catch (err) {
      console.error('Error saving profile:', err);
      this.showToast('Update failed. Try again.', 'danger');
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  togglePassword(field: 'current' | 'new') {
    if (field === 'current') this.showCurrentPassword = !this.showCurrentPassword;
    else this.showNewPassword = !this.showNewPassword;
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.showToast('Logged Out Successfully', 'success');
      this.navCtrl.navigateRoot('/login');
    } catch (error) {
      this.showToast('Logout failed. Try again.', 'danger');
    }
  }
}
