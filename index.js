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

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'image-' + Date.now() + ext); 
    }
});
const upload = multer({ storage: storage });

let scheduleHistory = [];
let connectionStatus = 'Disconnected';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// 🔥 PUDHU QR CODE LINE 🔥
client.on('qr', (qr) => {
    console.log('Indha QR Code-ah scan pannunga Basha:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    connectionStatus = 'Connected';
    console.log('Mass! WhatsApp pakka-va connect aaiduchu.');
});

app.get('/api/status', (req, res) => res.json({ status: connectionStatus }));

app.get('/api/groups', async (req, res) => {
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        const groupData = groups.map(g => ({ id: g.id._serialized, name: g.name }));
        res.json(groupData);
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/schedules', (req, res) => {
    res.json(scheduleHistory);
});

app.post('/api/schedule', upload.single('image'), (req, res) => {
    const { groupId, groupName, message, date, time } = req.body; 
    const file = req.file; 

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
                const media = MessageMedia.fromFilePath(file.path);
                await client.sendMessage(groupId, message, { media: media });
            } else {
                await client.sendMessage(groupId, message);
            }
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

// 🔥 INDHA PORT FIX THAAN RENDER CLOUD-KU THEVAI 🔥
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Server ${PORT}-la run aagudhu! 🚀`));
