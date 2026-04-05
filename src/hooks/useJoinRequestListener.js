import { useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import SimpleNotificationService from '../services/SimpleNotificationService';

export const useJoinRequestListener = (userId, userGroups) => {
  const processedRequestsRef = useRef(new Set());

  useEffect(() => {
    if (!userId || !userGroups || userGroups.length === 0) return;

    const unsubscribers = [];

    userGroups.forEach(group => {
      if (group.host === userId) {
        const sessionRef = doc(db, 'studySessions', group.id);

        const unsubscribe = onSnapshot(sessionRef, snapshot => {
          if (!snapshot.exists()) return;

          const data = snapshot.data();
          const joinRequests = data.joinRequests || [];

          joinRequests.forEach(request => {
            // Unique key per request
            const requestKey = `${group.id}_${request.uid}_${request.requestedAt}`;

            if (!processedRequestsRef.current.has(requestKey)) {
              processedRequestsRef.current.add(requestKey);

              // Show notification — works even if host is in study session
              SimpleNotificationService.showJoinRequest(
                requestKey,
                request.username,
                group.groupName,
                group.id,
              );
            }
          });
        });

        unsubscribers.push(unsubscribe);
      }
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
      processedRequestsRef.current.clear();
    };
  }, [userId, userGroups]);
};
