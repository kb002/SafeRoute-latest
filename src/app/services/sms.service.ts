import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SmsService {

  private apiKey = 'YOUR_SEMAPHORE_API_KEY'; // <-- Replace with your Semaphore API key
  private apiUrl = 'https://api.semaphore.co/api/v4/messages';

  constructor(private http: HttpClient) { }

  sendSms(phone: string, message: string): Observable<any> {
    const payload = {
      apikey: this.apiKey,
      number: phone,
      message: message
    };

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(this.apiUrl, payload, { headers });
  }
}
