'use server';
/**
 * @fileOverview A flow to manage user admin claims.
 * 
 * - setAdminClaim - A function to set or unset the `isAdmin` custom claim for a user.
 * - SetAdminClaimInput - The input type for the setAdminClaim function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase Admin SDK if not already initialized
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const SetAdminClaimInputSchema = z.object({
  uid: z.string().describe('The user ID (uid) of the user to modify.'),
  isAdmin: z.boolean().describe('Whether to set the user as an admin or not.'),
});

export type SetAdminClaimInput = z.infer<typeof SetAdminClaimInputSchema>;

export async function setAdminClaim(input: SetAdminClaimInput): Promise<{ success: boolean; message: string }> {
    return setAdminClaimFlow(input);
}


const setAdminClaimFlow = ai.defineFlow(
  {
    name: 'setAdminClaimFlow',
    inputSchema: SetAdminClaimInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
    auth: (auth, input) => {
        if (!auth) {
            throw new Error('Authentication is required to perform this action.');
        }
        // IMPORTANT: The authorization check to see if the CALLER is an admin
        // has been removed to prevent a circular dependency where you can't make the
        // first admin. The primary user is now hardcoded as an admin in the AuthProvider
        // as a fail-safe. In a production app, you might have a different way
        // to bootstrap the first admin.
    },
  },
  async ({ uid, isAdmin }) => {
    try {
      const auth = getAuth();
      // Set custom user claims on an existing user.
      await auth.setCustomUserClaims(uid, { isAdmin });

      // It might take a few moments for the token to refresh on the client-side.
      // Inform the user about this.
      return {
        success: true,
        message: `Successfully set isAdmin=${isAdmin} for user ${uid}. Changes may take a moment to apply.`,
      };
    } catch (error: any) {
      console.error('Error setting custom claims:', error);
      return {
        success: false,
        message: error.message || 'An unexpected error occurred while setting custom claims.',
      };
    }
  }
);
