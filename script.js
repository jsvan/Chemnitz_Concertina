class ConcertinaApp {
    constructor() {
        this.audioContext = null;
        this.isPush = false;
        this.scaleAnimation = null;
        this.isPlayingScale = false;
        this.showNotes = false;
        // Base frequencies for C4 octave (middle C = C4)
        this.baseFrequencies = {
            'c': 261.63,
            'c#': 277.18, 'db': 277.18,
            'd': 293.66,
            'd#': 311.13, 'eb': 311.13,
            'e': 329.63,
            'f': 349.23,
            'f#': 369.99, 'gb': 369.99,
            'g': 392.00,
            'g#': 415.30, 'ab': 415.30,
            'a': 440.00,
            'a#': 466.16, 'bb': 466.16,
            'b': 493.88
        };
        
        // Note-to-button mappings (will be populated in buildNoteMappings)
        this.leftHandPushMap = {};
        this.leftHandPullMap = {};
        this.rightHandPushMap = {};
        this.rightHandPullMap = {};
        
        this.init();
    }
    
    async init() {
        this.setupAudioContext();
        this.buildNoteMappings();
        this.createButtons();
        this.setupToggle();  // Move after createButtons
        this.setupEventListeners();
        this.setupScaleControls();
    }
    
    setupAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    buildNoteMappings() {
        // Build mappings from note+octave strings to button IDs
        
        // Process left hand
        concertinaData.left_hand.forEach(buttonData => {
            const buttonId = buttonData.button;
            
            if (buttonData.push) {
                this.leftHandPushMap[buttonData.push] = buttonId;
            }
            if (buttonData.pull) {
                this.leftHandPullMap[buttonData.pull] = buttonId;
            }
        });
        
        // Process right hand
        concertinaData.right_hand.forEach(buttonData => {
            const buttonId = buttonData.button;
            
            if (buttonData.push) {
                this.rightHandPushMap[buttonData.push] = buttonId;
            }
            if (buttonData.pull) {
                this.rightHandPullMap[buttonData.pull] = buttonId;
            }
        });
    }
    
    getButtonForNote(note, octave, hand, direction) {
        // Convert note name and octave to the format used in our mappings (e.g., "C4", "F#3")
        const noteKey = note + octave;
        
        // Select the appropriate mapping based on hand and direction
        let mapping;
        if (hand === 'left' && direction === 'push') {
            mapping = this.leftHandPushMap;
        } else if (hand === 'left' && direction === 'pull') {
            mapping = this.leftHandPullMap;
        } else if (hand === 'right' && direction === 'push') {
            mapping = this.rightHandPushMap;
        } else if (hand === 'right' && direction === 'pull') {
            mapping = this.rightHandPullMap;
        } else {
            return null;
        }
        
        // Return the button ID or null if not found
        return mapping[noteKey] || null;
    }
    
    generateScale(rootNote, scaleType, leftStartOctave) {
        // Chromatic scale using sharps only
        const chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Scale patterns (intervals in semitones)
        const scalePatterns = {
            'major': [0, 2, 4, 5, 7, 9, 11, 12], // W-W-H-W-W-W-H
            'minor': [0, 2, 3, 5, 7, 8, 10, 12]  // W-H-W-W-H-W-W
        };
        
        const pattern = scalePatterns[scaleType];
        if (!pattern) {
            console.error(`Unknown scale type: ${scaleType}`);
            return [];
        }
        
        // Find root note index in chromatic scale
        const rootIndex = chromaticNotes.indexOf(rootNote);
        if (rootIndex === -1) {
            console.error(`Unknown root note: ${rootNote}`);
            return [];
        }
        
        const scaleNotes = [];
        const maxLeftOctave = 4;
        const maxRightOctave = 6;
        
        // Generate scale notes across multiple octaves
        let currentLeftOctave = leftStartOctave;
        let currentRightOctave = leftStartOctave + 2; // Right hand is 2 octaves higher
        let degreeCounter = 1;
        
        while (currentLeftOctave <= maxLeftOctave || currentRightOctave <= maxRightOctave) {
            for (let i = 0; i < pattern.length - 1; i++) { // -1 to avoid repeating octave note
                const semitones = pattern[i];
                const noteIndex = (rootIndex + semitones) % 12;
                const octaveOffset = Math.floor((rootIndex + semitones) / 12);
                
                const leftOctave = currentLeftOctave + octaveOffset;
                const rightOctave = currentRightOctave + octaveOffset;
                
                // Only add if within range
                if (leftOctave <= maxLeftOctave || rightOctave <= maxRightOctave) {
                    scaleNotes.push({
                        note: chromaticNotes[noteIndex],
                        leftOctave: leftOctave,
                        rightOctave: rightOctave,
                        degree: degreeCounter
                    });
                    degreeCounter++;
                }
            }
            
            // Move to next octave
            currentLeftOctave++;
            currentRightOctave++;
            
            // Prevent infinite loop
            if (currentLeftOctave > maxLeftOctave && currentRightOctave > maxRightOctave) {
                break;
            }
        }
        
        return scaleNotes;
    }
    
    setupToggle() {
        const toggle = document.getElementById('push-pull-toggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.isPush = e.target.checked;
                this.updateNotesDisplay('Toggle changed to ' + (this.isPush ? 'Push' : 'Pull'));
                
                // If in Note display mode, update the button display
                const displayToggle = document.getElementById('display-toggle');
                if (displayToggle && displayToggle.checked && window.forceToggleDisplay) {
                    window.forceToggleDisplay(true);
                }
            });
        }
        
        // Display toggle is now handled by inline script in HTML
    }
    
    createButtons() {
        this.createButtonsForHand('left', concertinaData.left_hand);
        this.createButtonsForHand('right', concertinaData.right_hand);
    }
    
    createButtonsForHand(hand, buttonData) {
        const grid = document.querySelector(`.${hand}-grid`);
        
        // Group buttons by row
        const buttonsByRow = {};
        buttonData.forEach(buttonInfo => {
            const row = buttonInfo.row;
            if (!buttonsByRow[row]) {
                buttonsByRow[row] = [];
            }
            buttonsByRow[row].push(buttonInfo);
        });
        
        // Create row containers and add buttons in proper concertina order
        const rowOrder = hand === 'right' ? ['row1', 'row2', 'row3'] : ['row1', 'row2', 'row3', 'row4'];
        rowOrder.forEach(rowName => {
            if (!buttonsByRow[rowName]) return;
            const rowContainer = document.createElement('div');
            rowContainer.className = `button-row ${rowName}`;
            
            buttonsByRow[rowName].forEach(buttonInfo => {
                const button = document.createElement('button');
                button.className = 'concertina-button';
                button.textContent = buttonInfo.button;
                button.dataset.hand = hand;
                button.dataset.buttonId = buttonInfo.button;
                button.dataset.push = buttonInfo.push || '';
                button.dataset.pull = buttonInfo.pull || '';
                button.dataset.originalText = buttonInfo.button;
                
                button.addEventListener('click', () => {
                    this.playButton(buttonInfo, hand);
                });
                
                rowContainer.appendChild(button);
            });
            
            grid.appendChild(rowContainer);
        });
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                const toggle = document.getElementById('push-pull-toggle');
                toggle.checked = !toggle.checked;
                this.isPush = toggle.checked;
                this.updateNotesDisplay('Toggle changed to ' + (this.isPush ? 'Push' : 'Pull'));
            }
        });
    }
    
    async playButton(buttonInfo, hand) {
        if (!this.audioContext) {
            await this.setupAudioContext();
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        const note = this.isPush ? buttonInfo.push : buttonInfo.pull;
        
        this.updateNotesDisplay(`${buttonInfo.button}: ${note} (${this.isPush ? 'Push' : 'Pull'})`);
        
        const button = document.querySelector(`[data-hand="${hand}"][data-button-id="${buttonInfo.button}"]`);
        if (button) {
            button.classList.add('pressed');
            setTimeout(() => button.classList.remove('pressed'), 200);
        }
        
        this.playNote(note);
    }
    
    playNote(note) {
        const duration = 0.8;
        const now = this.audioContext.currentTime;
        
        const frequency = this.getFrequency(note);
        if (frequency) {
            this.playTone(frequency, now, duration);
        }
    }
    
    getFrequency(noteWithOctave) {
        // Parse note like "Bb4" into note="bb" and octave=4
        const match = noteWithOctave.match(/([A-Ga-g][b#]?)(\d+)/);
        if (!match) return null;
        
        const note = match[1].toLowerCase();
        const octave = parseInt(match[2]);
        
        const baseFreq = this.baseFrequencies[note];
        if (!baseFreq) return null;
        
        // Calculate frequency for the specific octave
        // C4 is our base octave, so multiply/divide by 2 for each octave difference
        const octaveDifference = octave - 4;
        return baseFreq * Math.pow(2, octaveDifference);
    }
    
    playTone(frequency, startTime, duration) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }
    
    updateNotesDisplay(text) {
        const display = document.getElementById('notes-display');
        display.textContent = text;
    }
    
    setupScaleControls() {
        const playButton = document.getElementById('play-scale');
        const playNoteButton = document.getElementById('play-note');
        
        playButton.addEventListener('click', () => this.playScale());
        playNoteButton.addEventListener('click', () => this.playSelectedNote());
    }
    
    async playScale() {
        if (this.isPlayingScale) return;
        
        const direction = this.isPush ? 'push' : 'pull';
        const key = document.querySelector('input[name="scale-key"]:checked').value;
        const type = document.getElementById('scale-type-toggle').checked ? 'minor' : 'major';
        
        // Generate the theoretical scale starting at octave 2 for left hand
        const scaleNotes = this.generateScale(key, type, 2);
        
        if (scaleNotes.length === 0) {
            this.updateNotesDisplay('Scale not available for this configuration');
            return;
        }
        
        this.isPlayingScale = true;
        document.getElementById('play-scale').disabled = true;
        
        for (let i = 0; i < scaleNotes.length; i++) {
            if (!this.isPlayingScale) break;
            
            const scaleNote = scaleNotes[i];
            
            // Find buttons for both hands at this scale degree
            const leftButtonId = this.getButtonForNote(scaleNote.note, scaleNote.leftOctave, 'left', direction);
            const rightButtonId = this.getButtonForNote(scaleNote.note, scaleNote.rightOctave, 'right', direction);
            
            // Only play and wait if at least one button is available
            if (leftButtonId || rightButtonId) {
                // Play both hands simultaneously at this step
                await this.playBothHandsNoteByButton(leftButtonId, rightButtonId, direction, key, type, scaleNote);
                await this.delay(1000); // One second between notes
            }
            // If no buttons available, skip immediately without delay
        }
        
        this.isPlayingScale = false;
        document.getElementById('play-scale').disabled = false;
        this.updateNotesDisplay('Scale finished');
    }
    
    async playBothHandsNote(leftButtonId, rightButtonId, direction, key, type) {
        const notes = [];
        const buttonInfo = [];
        
        // Process left hand button if it exists
        if (leftButtonId) {
            const leftButtonInfo = concertinaData.left_hand.find(btn => btn.button === leftButtonId);
            if (leftButtonInfo) {
                const leftNote = direction === 'push' ? leftButtonInfo.push : leftButtonInfo.pull;
                notes.push(leftNote);
                buttonInfo.push({ hand: 'left', buttonId: leftButtonId, note: leftNote });
                
                // Highlight the left button
                const leftButton = document.querySelector(`[data-hand="left"][data-button-id="${leftButtonId}"]`);
                if (leftButton) {
                    leftButton.classList.add('scale-highlight');
                    setTimeout(() => leftButton.classList.remove('scale-highlight'), 800);
                }
            }
        }
        
        // Process right hand button if it exists
        if (rightButtonId) {
            const rightButtonInfo = concertinaData.right_hand.find(btn => btn.button === rightButtonId);
            if (rightButtonInfo) {
                const rightNote = direction === 'push' ? rightButtonInfo.push : rightButtonInfo.pull;
                notes.push(rightNote);
                buttonInfo.push({ hand: 'right', buttonId: rightButtonId, note: rightNote });
                
                // Highlight the right button
                const rightButton = document.querySelector(`[data-hand="right"][data-button-id="${rightButtonId}"]`);
                if (rightButton) {
                    rightButton.classList.add('scale-highlight');
                    setTimeout(() => rightButton.classList.remove('scale-highlight'), 800);
                }
            }
        }
        
        // Play all notes simultaneously
        if (notes.length > 0) {
            const now = this.audioContext.currentTime;
            const duration = 0.8;
            
            notes.forEach(note => {
                const frequency = this.getFrequency(note);
                if (frequency) {
                    this.playTone(frequency, now, duration);
                }
            });
            
            // Update display with both hands info
            const displayInfo = buttonInfo.map(info => `${info.buttonId}(${info.hand}): ${info.note}`).join(' + ');
            this.updateNotesDisplay(`${key} ${type}: ${displayInfo} (${direction})`);
        }
    }
    
    async playBothHandsNoteByButton(leftButtonId, rightButtonId, direction, key, type, scaleNote) {
        const notes = [];
        const buttonInfo = [];
        
        // Process left hand button if it exists
        if (leftButtonId) {
            const leftButtonInfo = concertinaData.left_hand.find(btn => btn.button === leftButtonId);
            if (leftButtonInfo) {
                const leftNote = direction === 'push' ? leftButtonInfo.push : leftButtonInfo.pull;
                notes.push(leftNote);
                buttonInfo.push({ hand: 'left', buttonId: leftButtonId, note: leftNote });
                
                // Highlight the left button
                const leftButton = document.querySelector(`[data-hand="left"][data-button-id="${leftButtonId}"]`);
                if (leftButton) {
                    leftButton.classList.add('scale-highlight');
                    setTimeout(() => leftButton.classList.remove('scale-highlight'), 800);
                }
            }
        }
        
        // Process right hand button if it exists
        if (rightButtonId) {
            const rightButtonInfo = concertinaData.right_hand.find(btn => btn.button === rightButtonId);
            if (rightButtonInfo) {
                const rightNote = direction === 'push' ? rightButtonInfo.push : rightButtonInfo.pull;
                notes.push(rightNote);
                buttonInfo.push({ hand: 'right', buttonId: rightButtonId, note: rightNote });
                
                // Highlight the right button
                const rightButton = document.querySelector(`[data-hand="right"][data-button-id="${rightButtonId}"]`);
                if (rightButton) {
                    rightButton.classList.add('scale-highlight');
                    setTimeout(() => rightButton.classList.remove('scale-highlight'), 800);
                }
            }
        }
        
        // Play all notes simultaneously
        if (notes.length > 0) {
            const now = this.audioContext.currentTime;
            const duration = 0.8;
            
            notes.forEach(note => {
                const frequency = this.getFrequency(note);
                if (frequency) {
                    this.playTone(frequency, now, duration);
                }
            });
            
            // Update display with scale degree and available notes
            const displayInfo = buttonInfo.map(info => `${info.buttonId}(${info.hand}): ${info.note}`).join(' + ');
            const availableHands = buttonInfo.map(info => info.hand).join('+');
            this.updateNotesDisplay(`${key} ${type} degree ${scaleNote.degree} (${scaleNote.note}): ${displayInfo} (${direction})`);
        } else {
            // No buttons available for this note in this direction
            this.updateNotesDisplay(`${key} ${type} degree ${scaleNote.degree} (${scaleNote.note}): Not available on ${direction}`);
        }
    }

    async playScaleNote(buttonId, hand, direction) {
        // Find the button data
        const handData = hand === 'right' ? concertinaData.right_hand : concertinaData.left_hand;
        const buttonInfo = handData.find(btn => btn.button === buttonId);
        
        if (!buttonInfo) return;
        
        // Get the note for the specified direction
        const note = direction === 'push' ? buttonInfo.push : buttonInfo.pull;
        
        // Highlight the button
        const button = document.querySelector(`[data-hand="${hand}"][data-button-id="${buttonId}"]`);
        if (button) {
            button.classList.add('scale-highlight');
            setTimeout(() => button.classList.remove('scale-highlight'), 800);
        }
        
        // Play the note
        this.playNote(note);
        
        // Update display
        const key = document.querySelector('input[name="scale-key"]:checked').value;
        const type = document.getElementById('scale-type-toggle').checked ? 'minor' : 'major';
        this.updateNotesDisplay(`${key} ${type}: ${buttonId} → ${note} (${direction})`);
    }
    
    async playSelectedNote() {
        const selectedKey = document.querySelector('input[name="scale-key"]:checked').value;
        const direction = this.isPush ? 'push' : 'pull';
        
        // Find all buttons that play the selected key (tonic) in the chosen direction
        const tonicNotes = this.findTonicNotes(selectedKey, direction);
        
        if (tonicNotes.length === 0) {
            this.updateNotesDisplay(`No ${selectedKey} notes found for ${direction}`);
            return;
        }
        
        // Play all tonic notes simultaneously
        const now = this.audioContext.currentTime;
        tonicNotes.forEach(noteInfo => {
            const frequency = this.getFrequency(noteInfo.note);
            if (frequency) {
                this.playTone(frequency, now, 1.0);
            }
            
            // Highlight the button
            const button = document.querySelector(`[data-hand="${noteInfo.hand}"][data-button-id="${noteInfo.buttonId}"]`);
            if (button) {
                button.classList.add('scale-highlight');
                setTimeout(() => button.classList.remove('scale-highlight'), 1000);
            }
        });
        
        // Update display
        const noteList = tonicNotes.map(n => `${n.buttonId}(${n.hand}): ${n.note}`).join(', ');
        this.updateNotesDisplay(`${selectedKey} ${direction}: ${noteList}`);
    }
    
    findTonicNotes(selectedKey, direction) {
        const tonicNotes = [];
        
        // Normalize the selected key for comparison
        const normalizedKey = this.normalizeNoteName(selectedKey.toLowerCase());
        
        // Search both hands
        ['left_hand', 'right_hand'].forEach(handKey => {
            const hand = handKey.replace('_hand', '');
            concertinaData[handKey].forEach(buttonData => {
                const note = buttonData[direction];
                if (note) {
                    // Extract just the note name without octave
                    const noteMatch = note.match(/([A-Ga-g][b#]?)/);
                    if (noteMatch) {
                        const noteName = this.normalizeNoteName(noteMatch[1].toLowerCase());
                        if (noteName === normalizedKey) {
                            tonicNotes.push({
                                hand: hand,
                                buttonId: buttonData.button,
                                note: note
                            });
                        }
                    }
                }
            });
        });
        
        return tonicNotes;
    }
    
    normalizeNoteName(noteName) {
        // Convert enharmonic equivalents to a standard form
        const conversions = {
            'c#': 'db', 'db': 'db',
            'd#': 'eb', 'eb': 'eb', 
            'f#': 'gb', 'gb': 'gb',
            'g#': 'ab', 'ab': 'ab',
            'a#': 'bb', 'bb': 'bb'
        };
        
        return conversions[noteName] || noteName;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ConcertinaApp();
});