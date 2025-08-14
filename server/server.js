const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 3000;

// Configuración de Multer para manejar los archivos
const upload = multer();

// Permite peticiones desde tu frontend
app.use(cors({ origin: 'http://127.0.0.1:5500' }));

app.post('/api/send-email', upload.single('pdfFile'), async (req, res) => {
    try {
        // Extrae los datos del cuerpo de la petición
        const { fullName, workReference, email, equipment, ...rest } = req.body;
        const pdfFile = req.file;

        if (!pdfFile) {
            return res.status(400).json({ error: 'No se encontró el archivo PDF.' });
        }

        // Configuración de Nodemailer (usa tus datos de Gmail)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'spmalaga@gmail.com', // Reemplaza con tu dirección de correo
                pass: 'ingenierias3' // Reemplaza con tu contraseña de aplicación
            }
        });

        // Opciones del correo electrónico
        const mailOptions = {
            from: 'TU_CORREO@gmail.com',
            to: email, // El correo del destinatario, tomado del formulario
            subject: `Informe de Identificación de Cable - Ref: ${workReference}`,
            html: `
                <p>Hola,</p>
                <p>Adjunto el informe de identificación de cable con la siguiente información:</p>
                <ul>
                    <li><strong>Referencia del trabajo:</strong> ${workReference}</li>
                    <li><strong>Nombre del trabajador:</strong> ${fullName}</li>
                    <li><strong>Descripción del cable:</strong> ${rest.cableDescription}</li>
                    <li><strong>Cadena eléctrica:</strong> ${rest.chainDescription}</li>
                    <li><strong>Descripción del marcado:</strong> ${rest.markedDescription}</li>
                    <li><strong>Empresa:</strong> ${rest.company}</li>
                    <li><strong>Equipo utilizado:</strong> ${equipment}</li>
                    <li><strong>Correo de destino:</strong> ${email}</li>
                    <li><strong>Fecha:</strong> ${rest.date}</li>
                    <li><strong>Ubicación:</strong> Lat: ${JSON.parse(rest.location).latitude}, Lon: ${JSON.parse(rest.location).longitude}</li>
                    <li><strong>Dirección:</strong> ${rest.address}</li>
                </ul>
                <p>Se adjunta el PDF con el resumen completo y las fotos.</p>
            `,
            attachments: [
                {
                    filename: pdfFile.originalname,
                    content: pdfFile.buffer,
                    contentType: pdfFile.mimetype
                }
            ]
        };
        
        // Agrega las fotos como archivos adjuntos
        const photos = JSON.parse(rest.photos);
        photos.forEach((photo, index) => {
            mailOptions.attachments.push({
                filename: `foto_${index + 1}.png`,
                content: photo.split(';base64,').pop(),
                encoding: 'base64'
            });
        });

        // Agrega la firma como archivo adjunto
        mailOptions.attachments.push({
            filename: 'firma.png',
            content: rest.signature.split(';base64,').pop(),
            encoding: 'base64'
        });

        // Envía el correo electrónico
        await transporter.sendMail(mailOptions);
        console.log('Correo enviado con éxito');
        res.status(200).json({ message: 'Correo enviado con éxito' });

    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor de correo escuchando en http://localhost:${port}`);
});
