import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.css']
})
export class SplashComponent implements OnInit, OnDestroy {
  private navigateTimeoutId?: ReturnType<typeof setTimeout>;
  private settingsSubscription?: Subscription;

  schoolName = 'School Management System'; // Default, will be updated from settings
  schoolLogo: string | null = null;
  readonly defaultLogoPath = 'assets/logo.jpg';
  tagline = 'School Management System – Powered by Trynos Zhou';
  loadingSettings = true;

  constructor(
    private router: Router,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadSettings();

    // Automatically redirect to login after short delay
    this.navigateTimeoutId = setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3500);
  }

  ngOnDestroy(): void {
    if (this.navigateTimeoutId) {
      clearTimeout(this.navigateTimeoutId);
    }

    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }

  onLogoError(): void {
    // Fallback to default logo if school logo fails to load
    this.schoolLogo = null;
  }

  private loadSettings(): void {
    this.settingsSubscription = this.settingsService.getPublicSplashSettings().subscribe({
      next: (settings: any) => {
        // Always use school name from settings if available
        if (settings?.schoolName) {
          this.schoolName = settings.schoolName;
        } else if (settings?.schoolName === null || settings?.schoolName === '') {
          // Keep default if school name is empty in settings
          this.schoolName = 'School Management System';
        }
        
        // Use School Logo 1 (schoolLogo) from settings for splash screen
        // Only use School Logo 1, not Logo 2
        // Always prioritize the logo from settings
        if (settings?.schoolLogo !== null && settings?.schoolLogo !== undefined) {
          const logoValue = settings.schoolLogo;
          if (typeof logoValue === 'string' && logoValue.trim() !== '' && logoValue !== 'null' && logoValue !== 'undefined') {
            // Ensure it's a valid base64 data URL or URL
            if (logoValue.startsWith('data:image')) {
              // Already a valid data URL
              this.schoolLogo = logoValue;
            } else if (logoValue.startsWith('http://') || logoValue.startsWith('https://')) {
              // Valid URL
              this.schoolLogo = logoValue;
            } else {
              // If it's base64 without data URL prefix, add it
              this.schoolLogo = 'data:image/jpeg;base64,' + logoValue;
            }
          } else {
            // Logo is empty or invalid, set to null (will use default)
            this.schoolLogo = null;
          }
        } else {
          // No logo in settings, set to null (will use default)
          this.schoolLogo = null;
        }
        
        if (settings?.schoolMotto) {
          this.tagline = settings.schoolMotto;
        }
        this.loadingSettings = false;
      },
      error: (error) => {
        // On error, keep default school name and logo
        console.error('Error loading splash settings:', error);
        this.loadingSettings = false;
      }
    });
  }
}

