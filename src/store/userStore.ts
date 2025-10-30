import { create } from 'zustand';
import type { UserProfile } from '@/models';
import { db } from '@/services/database';

interface UserStore {
  profile: UserProfile | null;
  isLoading: boolean;
  loadProfile: () => Promise<void>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  isLoading: false,

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      const profiles = await db.profiles.toArray();
      const profile = profiles[0] || null;
      set({ profile, isLoading: false });
    } catch (error) {
      console.error('Error loading profile:', error);
      set({ isLoading: false });
    }
  },

  saveProfile: async (profile: UserProfile) => {
    try {
      if (profile.id) {
        await db.profiles.update(profile.id, profile);
      } else {
        await db.profiles.add(profile);
      }
      set({ profile });
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const currentProfile = get().profile;
    if (!currentProfile) return;

    const updatedProfile = { ...currentProfile, ...updates };
    await get().saveProfile(updatedProfile);
  },
}));

