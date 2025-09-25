import { Workbox } from 'workbox-window';

// PWA Service Worker Registration
export const registerSW = () => {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js');
    
    wb.addEventListener('controlling', () => {
      // Service worker is controlling the page
      console.log('Service worker is now controlling the page');
    });

    wb.addEventListener('waiting', () => {
      // New service worker is waiting
      console.log('New service worker is waiting');
      
      // Show update notification to user
      if (confirm('New version available! Reload to update?')) {
        wb.addEventListener('controlling', () => {
          window.location.reload();
        });
        wb.messageSkipWaiting();
      }
    });

    wb.register().then((registration) => {
      console.log('Service worker registered successfully:', registration);
    }).catch((error) => {
      console.log('Service worker registration failed:', error);
    });
  }
};

// PWA Install Prompt
export const setupInstallPrompt = () => {
  let deferredPrompt: any;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install button or notification
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    // Hide install button
    hideInstallButton();
  });

  const showInstallButton = () => {
    // Create install button if it doesn't exist
    let installButton = document.getElementById('pwa-install-button');
    if (!installButton) {
      installButton = document.createElement('button');
      installButton.id = 'pwa-install-button';
      installButton.innerHTML = '📱 Install App';
      installButton.className = 'fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 z-50';
      installButton.onclick = () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the install prompt');
            } else {
              console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
          });
        }
      };
      document.body.appendChild(installButton);
    }
  };

  const hideInstallButton = () => {
    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
      installButton.remove();
    }
  };
};

// Offline Detection
export const setupOfflineDetection = () => {
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    const statusElement = document.getElementById('offline-status');
    
    if (statusElement) {
      statusElement.textContent = isOnline ? 'Online' : 'Offline';
      statusElement.className = isOnline 
        ? 'fixed top-4 right-4 bg-green-500 text-white px-3 py-1 rounded text-sm z-50'
        : 'fixed top-4 right-4 bg-red-500 text-white px-3 py-1 rounded text-sm z-50';
    } else if (!isOnline) {
      // Create offline indicator
      const indicator = document.createElement('div');
      indicator.id = 'offline-status';
      indicator.textContent = 'Offline';
      indicator.className = 'fixed top-4 right-4 bg-red-500 text-white px-3 py-1 rounded text-sm z-50';
      document.body.appendChild(indicator);
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
};

// Initialize PWA features
export const initializePWA = () => {
  registerSW();
  setupInstallPrompt();
  setupOfflineDetection();
};
