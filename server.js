const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const baseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

function extractFromCookies(cookies, key) {
  const cookie = cookies.find(c => c.startsWith(`${key}=`));
  return cookie ? cookie.split(`${key}=`)[1].split(';')[0] : null;
}
async function getSwiggySession(retryCount = 0) {
  try {
    const initialResponse = await axios.get('https://www.swiggy.com', { headers: baseHeaders });
    const cookies = initialResponse.headers['set-cookie'];

    const deviceId = extractFromCookies(cookies, '_device_id');

    if (!deviceId) {
      console.error('Failed to retrieve Device ID');
      return null;
    }

    return {
      deviceId,
      cookies,
    };
  } catch (error) {
    console.error(`Error fetching Swiggy session on attempt ${retryCount + 1}:`, error.message);
    if (retryCount < 3) {
      return getSwiggySession(retryCount + 1); 
    }
    return null;
  }
}


app.get('/api/restaurants', async (req, res) => {
  try {

    const lat = req.query.lat || '12.9351929';
    const lng = req.query.lng || '77.62448069999999';

    const requestHeaders = {
      ...baseHeaders,
      'Referer': 'https://www.swiggy.com/',
      'Origin': 'https://www.swiggy.com',
    };
    const response = await axios.get(
      `https://www.swiggy.com/dapi/restaurants/list/v5?lat=${lat}&lng=${lng}&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING`,
      { headers: requestHeaders }
    );
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching restaurants:', error.message);
    res.status(error.response ? error.response.status : 500).json({ error: error.message });
  }
});

app.get('/api/menu', async (req, res) => {
  try {
    const resId = req.query.resId;
    const lat = req.query.lat || '12.9351929';
    const lng = req.query.lng || '77.62448069999999';

    const session = await getSwiggySession();

    if (!session) {
      return res.status(500).send('Failed to retrieve Device ID');
    }

    const { deviceId, cookies } = session;
 
    const swiggyHeaders = {
      ...baseHeaders,
      'X-Device-Id': deviceId,
      'Referer': 'https://www.swiggy.com/',
      'Origin': 'https://www.swiggy.com',
      'Cookie': cookies.join('; '), 
    };


    const menuResponse = await axios.get(
      `https://www.swiggy.com/dapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=${lat}&lng=${lng}&restaurantId=${resId}`,
      { headers: swiggyHeaders }
    );
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(menuResponse.data); 
  } catch (error) {
    console.error('Error fetching menu:', error.message);
    res.status(error.response ? error.response.status : 500).send(error.message);
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
