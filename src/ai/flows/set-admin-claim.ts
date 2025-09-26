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
            throw new Error('Authentication is required.');
        }
        if (!auth.token.isAdmin) {
          throw new Error('Only administrators can perform this action.');
        }
    },
  },
  async ({ uid, isAdmin }) => {
    try {
      const auth = getAuth();
      // Set custom user claims on an existing user.
      await auth.setCustomUserClaims(uid, { isAdmin });

      return {
        success: true,
        message: `Successfully set isAdmin=${isAdmin} for user ${uid}`,
      };
    } catch (error: any) {
      console.error('Error setting custom claims:', error);
      return {
        success: false,
        message: error.message || 'An unexpected error occurred.',
      };
    }
  }
);
