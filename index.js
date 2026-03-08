const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// FIX: Image-ah .jpg / .png extension oda save panna
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'image-' + Date.now() + ext); 
    }
});
const upload = multer({ storage: storage });

// HISTORY: Schedules-ah save panna oru array
let scheduleHistory = [];
let connectionStatus = 'Disconnected';

// WhatsApp Setup
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    console.log('QR Code generated!');
});

client.on('ready', () => {
    connectionStatus = 'Connected';
    console.log('Mass! WhatsApp pakka-va connect aaiduchu.');
});

// API: Frontend-ku Connection status anuppa
app.get('/api/status', (req, res) => res.json({ status: connectionStatus }));

// API: Groups fetch panna
app.get('/api/groups', async (req, res) => {
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        const groupData = groups.map(g => ({ id: g.id._serialized, name: g.name }));
        res.json(groupData);
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// API: Schedules History-ah frontend-ku anuppa
app.get('/api/schedules', (req, res) => {
    res.json(scheduleHistory);
});

// API: Schedule Message
app.post('/api/schedule', upload.single('image'), (req, res) => {
    const { groupId, groupName, message, date, time } = req.body; 
    const file = req.file; 

    // History-la save panna pudhu schedule data
    const newSchedule = {
        id: Date.now(),
        groupName: groupName || 'Unknown Group',
        message: message.length > 30 ? message.substring(0, 30) + '...' : message,
        time: `${date} at ${time}`,
        status: 'Pending'
    };
    scheduleHistory.push(newSchedule);

    const [hour, minute] = time.split(':');
    const cronTime = `${minute} ${hour} * * *`;

    console.log(`Scheduled: ${time} for ${newSchedule.groupName}`);

    cron.schedule(cronTime, async () => {
        try {
            if (file) {
                // Ippo pakka image ah pogum
                const media = MessageMedia.fromFilePath(file.path);
                await client.sendMessage(groupId, message, { media: media });
            } else {
                await client.sendMessage(groupId, message);
            }
            // Message ponathum status-ah Update pannanum
            const s = scheduleHistory.find(x => x.id === newSchedule.id);
            if(s) s.status = 'Sent';
            console.log('✅ Message Sent!');
        } catch (err) {
            const s = scheduleHistory.find(x => x.id === newSchedule.id);
            if(s) s.status = 'Failed';
            console.error('Error:', err);
        }
    });

    res.json({ success: true, message: 'Scheduled successfully!' });
});

client.initialize();
app.listen(3000, () => console.log('API Server 3000-la run aagudhu! 🚀'));