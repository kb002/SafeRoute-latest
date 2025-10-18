import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonInput, IonButton, IonIcon, ToastController, AlertController } from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';

import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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
export class LoginPage implements OnInit {

  loginForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(20),
          Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-={}[\]:;"'<>,.?/]{6,20}$/)
        ]
      ]
    });
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  async showToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const { email, password } = this.loginForm.value;

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if email is verified
      if (!user.emailVerified) {
        await this.showAlert('Email Not Verified', 'Your email is not verified. Please check your inbox.');
        this.isSubmitting = false;
        return;
      }

      this.showToast('Login successful!', 'success');
      this.router.navigateByUrl('/sos', { replaceUrl: true });

    } catch (error: any) {
      console.error('Login error:', error);

      let message = 'Login failed. Please try again.';
      switch (error.code) {
        case 'auth/invalid-email':
          message = 'Invalid email address format.';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email.';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Check your internet connection.';
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

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
