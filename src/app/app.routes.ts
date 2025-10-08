import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'landing',
    pathMatch: 'full',
  },
  {
    path: 'landing',
    loadComponent: () => import('./landing/landing.page').then( m => m.LandingPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.page').then( m => m.SignupPage)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.page').then( m => m.ForgotPasswordPage)
  },
  {
    path: 'sos',
    loadComponent: () => import('./sos/sos.page').then( m => m.SosPage)
  },
  {
    path: 'map',
    loadComponent: () => import('./map/map.page').then( m => m.MapPage)
  },
  {
    path: 'report',
    loadComponent: () => import('./report/report.page').then( m => m.ReportPage)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then( m => m.ProfilePage)
  },
  {
    path: 'contacts',
    loadComponent: () => import('./contacts/contacts.page').then( m => m.ContactsPage)
  },
  {
    path: 'view-contacts/:id',
    loadComponent: () =>
      import('./view-contacts/view-contacts.page').then(
        (m) => m.ViewContactsPage
      )
  },
  {
    path: 'add-contact',
    loadComponent: () => import('./add-contact/add-contact.page').then( m => m.AddContactPage)
  },
  {
    path: 'add-incident',
    loadComponent: () => import('./add-incident/add-incident.page').then( m => m.AddIncidentPage)
  },
  {
    path: 'view-report/:id',
    loadComponent: () => import('./view-report/view-report.page').then( m => m.ViewReportPage)
  },
  {
    path: 'edit-report',
    loadComponent: () => import('./edit-report/edit-report.page').then( m => m.EditReportPage)
  },
];
