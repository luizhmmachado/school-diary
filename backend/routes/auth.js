const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  createOrUpdateUser,
  getUserByEmail,
  getUserByGoogleId,
} = require('../config/dynamodb');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Função auxiliar para gerar JWT
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Login com Google
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    // Audiences permitidas (suporta múltiplos Client IDs via env)
    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_ID_ALT,
    ]
      .filter(Boolean)
      .map((s) => s.trim());

    if (allowedAudiences.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Configuração ausente: defina GOOGLE_CLIENT_ID (e opcionalmente GOOGLE_CLIENT_ID_ALT).',
      });
    }

    // Opcional: log do aud recebido para depuração
    try {
      const rawPayload = JSON.parse(Buffer.from(credential.split('.')[1], 'base64').toString('utf8'));
      console.log('Google aud (token):', rawPayload.aud, ' | allowed:', allowedAudiences);
    } catch (_) {}

    // Verificar o token do Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: allowedAudiences,
    });

    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'];
    const picture = payload['picture'];

    // Verificar se o usuário já existe
    let user = await getUserByGoogleId(googleId);

    if (!user) {
      // Se não existir, criar novo usuário
      const userData = {
        userId: uuidv4(),
        email,
        name,
        picture,
        googleId,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
      };

      const result = await createOrUpdateUser(userData);
      user = result.user;
    }

    // Gerar token JWT
    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      token,
    });
  } catch (error) {
    console.error('Erro no login com Google:', error);
    res.status(401).json({
      success: false,
      message: 'Falha na autenticação com Google',
    });
  }
});

// Login tradicional com email e senha
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuário
    const user = await getUserByEmail(email);

    if (!user || user.authProvider !== 'email') {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    // Gerar token JWT
    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar login',
    });
  }
});

// Registro tradicional com email e senha
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Verificar se o usuário já existe
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado',
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar novo usuário
    const userData = {
      userId: uuidv4(),
      email,
      name,
      password: hashedPassword,
      authProvider: 'email',
      createdAt: new Date().toISOString(),
    };

    const result = await createOrUpdateUser(userData);

    // Gerar token JWT
    const token = generateToken(result.user);

    res.json({
      success: true,
      user: {
        userId: result.user.userId,
        email: result.user.email,
        name: result.user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar conta',
    });
  }
});

module.exports = router;
