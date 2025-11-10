// app.js - Enhanced chat application with interactive features
(() => {
  // DOM Elements
  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('sendForm');
  const messageInput = document.getElementById('messageInput');
  const statusEl = document.getElementById('status');
  const typingIndicator = document.getElementById('typingIndicator');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const themeToggle = document.getElementById('themeToggle');
  const emojiPicker = document.getElementById('emojiPicker');
  
  // File input elements
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  fileInput.accept = 'image/*, .pdf, .doc, .docx, .txt';
  
  // Photo input element
  const photoInput = document.createElement('input');
  photoInput.type = 'file';
  photoInput.style.display = 'none';
  photoInput.accept = 'image/*';
  photoInput.capture = 'environment';
  
  // Add inputs to DOM
  document.body.append(fileInput, photoInput);
  
  // Button elements
  const attachmentBtn = document.querySelector('.attachment-button');
  const photoBtn = document.querySelector('.photo-button');
  const recordBtn = document.querySelector('.record-button');
  const linkBtn = document.querySelector('.link-button');
  const sendBtn = document.getElementById('sendButton');
  
  // Audio recording
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;
  
  // State
  let currentTheme = localStorage.getItem('theme') || 'light';
  let isSidebarOpen = window.innerWidth >= 768;
  
  // Predefined bot responses
  const botResponses = [
    "Hello! How can I assist you today?",
    "That's an interesting point. Could you tell me more?",
    "I understand. Is there anything specific you'd like to know?",
    "Thanks for sharing that with me.",
    "That's a great question! Let me think about that...",
    "I'm here to help. What else would you like to know?"
  ];
  
  // Emoji picker data
  const emojis = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇"];
  
  // Get or create username
  let username = localStorage.getItem('chat_username');
  if (!username) {
    username = prompt('Please enter your name:', `User${Math.floor(Math.random()*900+100)}`) || `User${Date.now()%1000}`;
    localStorage.setItem('chat_username', username);
    document.querySelector('.user-details h3').textContent = username;
  }

  // Initialize the application
  function init() {
    // Set initial theme
    setTheme(currentTheme);
    
    // Initialize event listeners
    setupEventListeners();
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Update UI based on input
    updateSendButtonState();
    
    // Initial bot greeting
    setTimeout(() => {
      addMessage("Hello! I'm your chat assistant. How can I help you today?", 'bot');
    }, 500);
    
    // Initialize header interactions
    initHeaderInteractions();
  }
  
  // Initialize header interactions
  function initHeaderInteractions() {
    // Toggle dropdown menu
    const moreOptions = document.getElementById('moreOptions');
    const dropdown = moreOptions?.closest('.dropdown');
    
    if (moreOptions && dropdown) {
      moreOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
    }
    
    // Handle tab switching
    const headerOptions = document.querySelectorAll('.header-option');
    headerOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remove active class from all options
        headerOptions.forEach(opt => opt.classList.remove('active'));
        // Add active class to clicked option
        option.classList.add('active');
        
        // Here you can add logic to switch between different views
        const view = option.dataset.option;
        console.log(`Switched to ${view} view`);
        // Add your view switching logic here
      });
    });
  }
  
  // Set up all event listeners
  function setupEventListeners() {
    // Theme toggle - only add if element exists
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Sidebar toggle for mobile
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Emoji picker
    if (emojiPicker) {
      emojiPicker.addEventListener('click', showEmojiPicker);
    }
    
    // File attachment
    if (attachmentBtn) {
      attachmentBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Photo capture/upload
    if (photoBtn) {
      photoBtn.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', handlePhotoUpload);
    }
    
    // Voice recording
    if (recordBtn) {
      recordBtn.addEventListener('mousedown', startRecording);
      recordBtn.addEventListener('mouseup', stopRecording);
      recordBtn.addEventListener('mouseleave', stopRecording);
      recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startRecording();
      });
      recordBtn.addEventListener('touchend', stopRecording);
    }
    
    // Link sharing
    if (linkBtn) {
      linkBtn.addEventListener('click', shareLink);
    }
    
    // Form submission
    form.addEventListener('submit', handleSubmit);
    
    // Input events
    messageInput.addEventListener('input', updateSendButtonState);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    });
  }
  
  // Connect to WebSocket
  function connectWebSocket() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${scheme}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.addEventListener('open', () => {
      statusEl.textContent = 'Connected';
      // announce join
      ws.send(JSON.stringify({ type: 'join', name: username }));
    });
    
    ws.addEventListener('close', () => {
      statusEl.textContent = 'Disconnected';
      // Try to reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    });
    
    ws.addEventListener('error', (e) => {
      statusEl.textContent = 'Connection error';
      console.error('WebSocket error', e);
    });
    
    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'message') {
          addMessage(data.text, data.name === username ? 'me' : 'bot', data.time);
        } else if (data.type === 'system') {
          addMessage(data.text, 'System', data.time);
        } else if (data.type === 'history') {
          // load past messages (if server sends)
          data.items.forEach(it => addMessage(it.text, it.name === username ? 'me' : 'bot', it.time));
        }
      } catch (err) {
        console.warn('Invalid message', evt.data);
      }
    });
    
    // Make ws available for sending messages
    window.ws = ws;
  }

  // Add a new message to the chat
  function addMessage(text, sender, time = Date.now()) {
    const li = document.createElement('li');
    const isMe = sender === 'me';
    li.className = `message ${isMe ? 'me' : ''}`;
    
    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    
    // Add message content
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = text;
    
    // Add message meta (time, status)
    const messageMeta = document.createElement('div');
    messageMeta.className = 'message-meta';
    
    const t = new Date(time);
    const timeString = t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = timeString;
    
    messageMeta.appendChild(timeSpan);
    
    // Assemble message
    messageContainer.appendChild(messageContent);
    messageContainer.appendChild(messageMeta);
    li.appendChild(messageContainer);
    
    // Add to DOM
    messagesEl.appendChild(li);
    
    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    return li;
  }
  
  function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
  }
  
  function getRandomResponse() {
    const randomIndex = Math.floor(Math.random() * botResponses.length);
    return botResponses[randomIndex];
  }
  
  function simulateBotResponse(userMessage) {
    showTypingIndicator();
    
    // Simulate thinking time (1-3 seconds)
    setTimeout(() => {
      hideTypingIndicator();
      const response = getRandomResponse();
      addMessage(response, 'bot');
    }, 1000 + Math.random() * 2000);
  }

  // Toggle theme between light and dark
  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
  }
  
  // Apply theme
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Check if theme toggle button exists before trying to update it
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const icon = theme === 'dark' ? 'sun' : 'moon';
      themeToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-${icon}">
          ${theme === 'dark' ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>' : 
          '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'}
        </svg>
      `;
    }
  }
  
  // Toggle sidebar on mobile
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      isSidebarOpen = !isSidebarOpen;
      sidebar.style.transform = isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)';
    }
  }
  
  // Show emoji picker
  function showEmojiPicker() {
    const emojiContainer = document.getElementById('emojiContainer');
    if (!emojiContainer) return;
    
    emojiContainer.innerHTML = emojis.map(emoji => 
      `<span class="emoji">${emoji}</span>`
    ).join('');
    
    emojiContainer.classList.toggle('visible');
    
    // Add click handler for emojis
    emojiContainer.querySelectorAll('.emoji').forEach(emojiEl => {
      emojiEl.addEventListener('click', () => {
        messageInput.textContent += emojiEl.textContent;
        messageInput.focus();
        emojiContainer.classList.remove('visible');
      });
    });
  }

  // Stop voice recording
  function stopRecording() {
  if (!isRecording) return;
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    isRecording = false;
    recordBtn.classList.remove('recording');
  }
}

// Handle file upload
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Show file in chat (simplified for example)
  const reader = new FileReader();
  reader.onload = (event) => {
    // In a real app, you would upload the file to a server here
    addMessage(`[File: ${file.name} (${formatFileSize(file.size)})`, 'me');
    simulateBotResponse(`I received your file: ${file.name}`);
  };
  reader.readAsDataURL(file);
  
  // Reset the input
  e.target.value = '';
}

// Handle photo upload
function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Show photo in chat (simplified for example)
  const reader = new FileReader();
  reader.onload = (event) => {
    // In a real app, you would upload the photo to a server here
    addMessage(`[Photo: ${file.name} (${formatFileSize(file.size)})`, 'me');
    simulateBotResponse('Nice photo!');
  };
  reader.readAsDataURL(file);
  
  // Reset the input
  e.target.value = '';
}

// Start voice recording
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      // In a real app, you would upload the audio to a server here
      addMessage('[Voice message]', 'me');
      simulateBotResponse('I received your voice message!');
    };
    
    mediaRecorder.start();
    isRecording = true;
    recordBtn.classList.add('recording');
  } catch (err) {
    console.error('Error accessing microphone:', err);
    addMessage('Error: Could not access microphone', 'system');
  }
}

// Share link
function shareLink() {
  const link = prompt('Enter the URL you want to share:');
  if (link) {
    addMessage(`[Shared link: ${link}]`, 'me');
    simulateBotResponse('Thanks for sharing this link!');
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
  
// Handle form submission
function handleSubmit(e) {
    e.preventDefault();
    const text = messageInput.textContent.trim();
    if (!text) return;
    
    // Add user message
    addMessage(text, 'me');
    messageInput.textContent = '';
    
    // Simulate bot response
    simulateBotResponse(text);
    
    // Send message via WebSocket if connected
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      const payload = { 
        type: 'message', 
        name: username, 
        text: text, 
        time: Date.now() 
      };
      window.ws.send(JSON.stringify(payload));
    }
  }
  
  // Simulate bot response
  function simulateBotResponse(userMessage) {
    showTypingIndicator();
    
    // Simulate thinking time (1-3 seconds)
    setTimeout(() => {
      hideTypingIndicator();
      const response = getRandomResponse();
      addMessage(response, 'bot');
    }, 1000 + Math.random() * 2000);
  }
  
  // Show typing indicator
  function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  // Hide typing indicator
  function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
  }
  
  // Get a random response from the bot
  function getRandomResponse() {
    const randomIndex = Math.floor(Math.random() * botResponses.length);
    return botResponses[randomIndex];
  }
  
  // Initialize the app
  init();
  
  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    const emojiContainer = document.getElementById('emojiContainer');
    if (emojiContainer && !emojiContainer.contains(e.target) && e.target !== emojiPicker) {
      emojiContainer.classList.remove('visible');
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    isSidebarOpen = window.innerWidth >= 768;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.style.transform = isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)';
    }
  });
})();
