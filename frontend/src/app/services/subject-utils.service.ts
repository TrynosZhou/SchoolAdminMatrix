import { Injectable } from '@angular/core';

export type SubjectCategory = 'IGCSE' | 'AS_A_LEVEL';

@Injectable({
  providedIn: 'root'
})
export class SubjectUtilsService {
  
  /**
   * Get display label for a subject category
   * @param category The category value from database ('IGCSE' or 'AS_A_LEVEL')
   * @returns Formatted display label ('IGCSE' or 'AS & A Level')
   */
  getCategoryLabel(category: SubjectCategory | string | null | undefined): string {
    if (!category) return 'IGCSE'; // Default
    return category === 'AS_A_LEVEL' ? 'AS & A Level' : 'IGCSE';
  }

  /**
   * Get all available categories with their display labels
   * @returns Array of category objects with value and label
   */
  getCategories(): Array<{ value: SubjectCategory; label: string }> {
    return [
      { value: 'IGCSE', label: 'IGCSE' },
      { value: 'AS_A_LEVEL', label: 'AS & A Level' }
    ];
  }

  /**
   * Normalize category value (convert display name to database value)
   * @param category Category string (can be display name or database value)
   * @returns Normalized database value
   */
  normalizeCategory(category: string | null | undefined): SubjectCategory {
    if (!category) return 'IGCSE';
    const upper = category.toUpperCase();
    if (upper === 'AS & A LEVEL' || upper === 'AS_A_LEVEL' || upper === 'AS A LEVEL') {
      return 'AS_A_LEVEL';
    }
    return 'IGCSE';
  }
}

