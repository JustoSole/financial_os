/**
 * Onboarding state management
 * Uses localStorage to persist onboarding completion state
 */

const ONBOARDING_COMPLETED_KEY = 'financial_os_onboarding_completed';

/**
 * Check if onboarding has been completed for a property
 */
export function isOnboardingCompleted(propertyId: string): boolean {
  try {
    const data = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    if (!data) return false;
    
    const completedProperties = JSON.parse(data);
    return completedProperties[propertyId] === true;
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as completed for a property
 */
export function markOnboardingCompleted(propertyId: string): void {
  try {
    const data = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    const completedProperties = data ? JSON.parse(data) : {};
    
    completedProperties[propertyId] = true;
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(completedProperties));
  } catch {
    // Silently fail if localStorage is not available
    console.warn('Could not save onboarding state to localStorage');
  }
}

/**
 * Reset onboarding state for a property (useful for testing or demo purposes)
 */
export function resetOnboarding(propertyId: string): void {
  try {
    const data = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    if (!data) return;
    
    const completedProperties = JSON.parse(data);
    delete completedProperties[propertyId];
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(completedProperties));
  } catch {
    // Silently fail
  }
}

/**
 * Reset all onboarding state (for testing)
 */
export function resetAllOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  } catch {
    // Silently fail
  }
}

