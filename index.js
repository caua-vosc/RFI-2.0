const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

const {
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT_ID,
  DRIVE_ID,
  PORT = 10000
} = process.env;

// TOKEN GRAPH
async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default'
  });

  const res = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    params
  );

  return res.data.access_token;
}

// CRIA PASTA SE NÃO EXISTIR
async function createFolder(token, path) {
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${path}`;
  try {
    await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    await axios.post(
      `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children`,
      {
        name: path.split('/')[0],
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}

// UPLOAD
async function uploadToOneDrive(token, siteId, section, file) {
  const folderPath = `${siteId}/${section}`;

  // cria pasta do site
  await axios.post(
    `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children`,
    {
      name: siteId,
      folder: {},
      "@microsoft.graph.conflictBehavior": "ignore"
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // cria pasta da seção
  await axios.post(
    `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${siteId}:/children`,
    {
      name: section,
      folder: {},
      "@microsoft.graph.conflictBehavior": "ignore"
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // upload arquivo
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

// ENDPOINT
app.post('/upload', upload.array('photos', 10), async (req, res) => {
  const { siteId, section } = req.body;

  if (!siteId || !section || !req.files.length)
    return res.status(400).json({ error: 'Dados incompletos' });

  try {
    const token = await getAccessToken();

    for (const file of req.files) {
      await uploadToOneDrive(token, siteId, section, file);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Erro no upload' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
