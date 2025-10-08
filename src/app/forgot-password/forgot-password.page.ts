import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonInput, IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';

import { auth } from 'src/app/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonInput,
    IonButton,
    IonIcon
  ]
})
export class ForgotPasswordPage implements OnInit {

  forgotForm!: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() { return this.forgotForm.get('email'); }

  async showToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }

  async onSubmit() {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const { email } = this.forgotForm.value;

      //Directly try sending reset email
      await sendPasswordResetEmail(auth, email.trim());
      this.showToast('If this email is registered, a reset link has been sent.', 'success');

      this.router.navigateByUrl('/login', { replaceUrl: true });

    } catch (error: any) {
      console.error('Password reset error:', error);

      let message = 'Failed to send reset email.';
      switch (error.code) {
        case 'auth/invalid-email':
          message = 'Invalid email address.';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection.';
          break;
        default:
          message = error.message || message;
          break;
      }

      this.showToast(message);
    } finally {
      this.isSubmitting = false;
    }
  }
}
