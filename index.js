require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors({
    origin: "https://caua-vosc.github.io/RFI-2.1", // frontend
    methods: ["GET","POST"],
    allowedHeaders: ["Content-Type"]
}));

const upload = multer({ dest: 'uploads/' });

const {
  CLIENT_ID = "8e727feb-6df8-4199-95da-464b5055ff88",
  CLIENT_SECRET = "a2c6ad58-a129-49bd-8444-8bc37db9b96d",
  TENANT_ID = "33281050-3a6e-471a-bb64-ea91e09f86e1",
  DRIVE_ID = "60b4c0e1-a74d-44b5-bf41-93c931b78222",
  PORT = 10000
} = process.env;

// 1️⃣ Obter token usando client_credentials
async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default'
  });

  const res = await axios.post(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, params);
  return res.data.access_token;
}

// 2️⃣ Criação de pastas
async function createFolder(token, folderPath) {
  try {
    // verifica se a pasta existe
    await axios.get(`https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${folderPath}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    // cria pasta
    const parent = folderPath.split('/').slice(0,-1).join('/') || '/';
    const folderName = folderPath.split('/').pop();
    await axios.post(`https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${parent}:/children`, 
      { name: folderName, folder: {}, "@microsoft.graph.conflictBehavior": "rename" },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}

// 3️⃣ Upload de arquivos
async function uploadToOneDrive(token, siteId, section, file) {
  const folderPath = `${siteId}/${section}`;

  // cria pasta site e seção se não existir
  await createFolder(token, siteId);
  await createFolder(token, folderPath);

  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${folderPath}/${file.originalname}:/content`;
  const stream = fs.createReadStream(file.path);

  await axios.put(url, stream, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream'
    }
  });

  fs.unlinkSync(file.path);
}

// 4️⃣ Endpoint de upload
app.post('/upload', upload.array('photos', 10), async (req, res) => {
  const { siteId, section } = req.body;

  if(!siteId || !section || !req.files.length)
    return res.status(400).json({ error: "Dados incompletos" });

  try {
    const token = await getAccessToken();

    for(const file of req.files){
      await uploadToOneDrive(token, siteId, section, file);
    }

    res.json({ success: true });
  } catch(err){
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Falha no upload" });
  }
});

app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
