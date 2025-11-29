import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClassService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getClasses(options: { page?: number; limit?: number; search?: string } = {}): Observable<any> {
    const params: any = {};
    if (options.page) params.page = String(options.page);
    if (options.limit) params.limit = String(options.limit);
    if (options.search) params.search = options.search;
    return this.http.get(`${this.apiUrl}/classes`, { params });
  }

  getClassById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/classes/${id}`);
  }

  createClass(classData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/classes`, classData);
  }

  updateClass(id: string, classData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/classes/${id}`, classData);
  }

  deleteClass(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/classes/${id}`);
  }
}

