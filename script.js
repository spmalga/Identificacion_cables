document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('photoCanvas');
    const photoPreview = document.getElementById('photoPreview');
    const takePhotoButton = document.getElementById('takePhotoButton');
    const dataForm = document.getElementById('dataForm');
    const locationDisplay = document.getElementById('location-display');
    const addressDisplay = document.getElementById('address-display');
    const photoList = document.getElementById('photoList');

    const signatureCanvas = document.getElementById('signatureCanvas');
    const signatureContext = signatureCanvas.getContext('2d');
    const clearSignatureBtn = document.getElementById('clearSignatureBtn');

    let stream = null;
    let capturedPhotos = [];
    let userLocation = null;
    let userAddress = null;

    let isDrawing = false;

    function setupSignatureCanvas() {
        signatureContext.lineWidth = 3;
        signatureContext.lineCap = 'round';
        signatureContext.strokeStyle = '#000';
    }

    function draw(e) {
        if (!isDrawing) return;
        signatureContext.lineTo(e.offsetX, e.offsetY);
        signatureContext.stroke();
    }

    signatureCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        signatureContext.beginPath();
        signatureContext.moveTo(e.offsetX, e.offsetY);
    });

    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', () => isDrawing = false);
    signatureCanvas.addEventListener('mouseout', () => isDrawing = false);

    signatureCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        isDrawing = true;
        signatureContext.beginPath();
        const rect = signatureCanvas.getBoundingClientRect();
        signatureContext.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });
    signatureCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (!isDrawing) return;
        const rect = signatureCanvas.getBoundingClientRect();
        signatureContext.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        signatureContext.stroke();
    });
    signatureCanvas.addEventListener('touchend', () => isDrawing = false);

    clearSignatureBtn.addEventListener('click', () => {
        signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    });

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
        } catch (err) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
            } catch (fallbackError) {
                console.error("Error al acceder a la cámara:", fallbackError);
                alert("No se pudo acceder a la cámara. Asegúrate de que el dispositivo tenga una y de que los permisos estén concedidos.");
            }
        }
    }

    takePhotoButton.addEventListener('click', () => {
        if (!stream) {
            alert("La cámara no está activa.");
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const newPhotoDataUrl = canvas.toDataURL('image/png');
        
        capturedPhotos.push(newPhotoDataUrl);
        
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'photo-thumbnail-container';

        const photoThumbnail = document.createElement('img');
        photoThumbnail.src = newPhotoDataUrl;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
            const index = capturedPhotos.indexOf(newPhotoDataUrl);
            if (index > -1) {
                capturedPhotos.splice(index, 1);
            }
            thumbnailContainer.remove();
        });

        thumbnailContainer.appendChild(photoThumbnail);
        thumbnailContainer.appendChild(deleteBtn);
        photoList.appendChild(thumbnailContainer);

        photoPreview.src = newPhotoDataUrl;
        photoPreview.style.border = 'none';
    });
    
    async function getAddressFromCoords(lat, lon) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.display_name;
        } catch (error) {
            console.error("Error al obtener la dirección:", error);
            return "Dirección no disponible.";
        }
    }

    function getLocation() {
        if ("geolocation" in navigator) {
            locationDisplay.textContent = "Obteniendo coordenadas...";
            addressDisplay.textContent = "";

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    userLocation = {
                        latitude: latitude,
                        longitude: longitude
                    };
                    locationDisplay.textContent = `Latitud: ${latitude}, Longitud: ${longitude}`;
                    
                    addressDisplay.textContent = "Obteniendo dirección...";
                    userAddress = await getAddressFromCoords(latitude, longitude);
                    addressDisplay.textContent = userAddress;

                },
                (error) => {
                    console.error("Error al obtener la ubicación:", error);
                    locationDisplay.textContent = "No se pudo obtener la ubicación. Por favor, revisa los permisos.";
                    addressDisplay.textContent = "";
                    userLocation = null;
                    userAddress = null;
                },
                { enableHighAccuracy: true }
            );
        } else {
            locationDisplay.textContent = "La geolocalización no está disponible en este navegador.";
            addressDisplay.textContent = "";
            userLocation = null;
            userAddress = null;
        }
    }

    dataForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const signatureDataUrl = signatureCanvas.toDataURL();
        if (signatureDataUrl.length < 500) {
            alert("Por favor, firma en el recuadro antes de enviar.");
            return;
        }

        if (capturedPhotos.length === 0) {
            alert("Por favor, toma al menos una foto antes de enviar.");
            return;
        }
        
        if (!userLocation) {
            alert("No se pudo obtener la ubicación. Por favor, revisa los permisos y vuelve a intentarlo.");
            return;
        }
        
        const submitButton = document.getElementById('submitButton');
        submitButton.textContent = 'Enviando...';
        submitButton.disabled = true;

        try {
            const formValues = {
                workReference: document.getElementById('workReference').value,
                cableDescription: document.getElementById('cableDescription').value,
                chainDescription: document.getElementById('chainDescription').value,
                markedDescription: document.getElementById('markedDescription').value,
                fullName: document.getElementById('fullName').value,
                company: document.getElementById('company').value,
                equipment: document.getElementById('equipment').value,
                email: document.getElementById('email').value,
                date: document.getElementById('date').value
            };
            
            const templateParams = {
                to_email: formValues.email,
                workReference: formValues.workReference,
                cableDescription: formValues.cableDescription,
                chainDescription: formValues.chainDescription,
                markedDescription: formValues.markedDescription,
                fullName: formValues.fullName,
                company: formValues.company,
                equipment: formValues.equipment,
                date: formValues.date,
                location: `Latitud: ${userLocation.latitude}, Longitud: ${userLocation.longitude}`,
                address: userAddress,
                signature_image: signatureDataUrl,
                captured_photos: capturedPhotos.map(photo => `<img src="${photo}" style="max-width:100%; height:auto; margin:5px;">`).join('')
            };

            // Envía los datos con EmailJS.
            await emailjs.send('service_z6hjbxo', 'template_5xca81q', templateParams);

            alert("¡El correo con el informe ha sido enviado con éxito!");
            console.log("Correo enviado. Datos:", templateParams);
        
        } catch (error) {
            console.error('Error al enviar el correo:', error);
            alert("Hubo un error al enviar el correo. Por favor, revisa la consola.");
        } finally {
            submitButton.textContent = 'Enviar Datos';
            submitButton.disabled = false;
        }
    });

    startCamera();
    getLocation();
    setupSignatureCanvas();
});