import { useEffect, useRef } from 'react';
import { database } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import SimpleNotificationService from '../services/SimpleNotificationService';

export const useJoinRequestListener = (userId, userGroups) => {
  const processedRequestsRef = useRef(new Set());

  useEffect(() => {
    if (!userId || !userGroups || userGroups.length === 0) return;

    const listeners = [];

    // Listen to join requests for each group the user hosts
    userGroups.forEach(group => {
      if (group.hostId === userId) {
        const requestsRef = ref(database, `join_requests/${group.id}`);

        const listener = onValue(requestsRef, snapshot => {
          if (snapshot.exists()) {
            const requests = snapshot.val();

            // Check for new pending requests
            Object.entries(requests).forEach(([requestId, request]) => {
              // Only show notification for pending requests we haven't processed yet
              if (
                request.status === 'pending' &&
                !processedRequestsRef.current.has(requestId)
              ) {
                // Mark as processed
                processedRequestsRef.current.add(requestId);

                // Show notification
                SimpleNotificationService.showJoinRequest(
                  requestId,
                  request.userName,
                  group.name,
                );
              }
            });
          }
        });

        listeners.push({ ref: requestsRef, listener });
      }
    });

    // Cleanup
    return () => {
      listeners.forEach(({ ref: dbRef }) => {
        off(dbRef);
      });
      processedRequestsRef.current.clear();
    };
  }, [userId, userGroups]);
};
