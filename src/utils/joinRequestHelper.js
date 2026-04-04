import { database, auth } from '../config/firebase';
import { ref, set, get } from 'firebase/database';

/**
 * Send a join request to a group
 * @param {string} groupId - The group ID
 * @param {string} groupName - The group name
 * @param {string} pin - The group PIN (verify before calling this)
 * @returns {Promise<boolean>} - Success status
 */
export const sendJoinRequest = async (groupId, groupName, pin) => {
  try {
    const userId = auth.currentUser.uid;
    const userName = auth.currentUser.displayName || 'Anonymous User';

    // Verify PIN first
    const groupRef = ref(database, `study_groups/${groupId}`);
    const groupSnapshot = await get(groupRef);

    if (!groupSnapshot.exists()) {
      throw new Error('Group not found');
    }

    const groupData = groupSnapshot.val();
    if (groupData.pin !== pin) {
      throw new Error('Invalid PIN');
    }

    // Check if user is already a member
    if (groupData.members && groupData.members[userId]) {
      throw new Error('You are already a member of this group');
    }

    // Check if user is the host
    if (groupData.hostId === userId) {
      throw new Error('You are the host of this group');
    }

    // Check if there's already a pending request
    const existingRequestsRef = ref(database, `join_requests/${groupId}`);
    const existingSnapshot = await get(existingRequestsRef);

    if (existingSnapshot.exists()) {
      const requests = existingSnapshot.val();
      const hasPendingRequest = Object.values(requests).some(
        req => req.userId === userId && req.status === 'pending',
      );

      if (hasPendingRequest) {
        throw new Error('You already have a pending request for this group');
      }
    }

    // Create join request
    const requestId = `${userId}_${Date.now()}`;
    const requestRef = ref(database, `join_requests/${groupId}/${requestId}`);

    await set(requestRef, {
      userId,
      userName,
      groupName,
      status: 'pending',
      timestamp: Date.now(),
    });

    console.log('Join request sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending join request:', error);
    throw error;
  }
};
