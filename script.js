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
            console.error("Error al acceder a la cámara:", err);
            alert("No se pudo acceder a la cámara. Asegúrate de dar los permisos.");
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
        
        const formValues = {
            workReference: document.getElementById('workReference').value,
            cableDescription: document.getElementById('cableDescription').value,
            chainDescription: document.getElementById('chainDescription').value,
            markedDescription: document.getElementById('markedDescription').value,
            fullName: document.getElementById('fullName').value,
            company: document.getElementById('company').value,
            date: document.getElementById('date').value
        };
        
        const submitButton = document.getElementById('submitButton');
        submitButton.textContent = 'Generando PDF...';
        submitButton.disabled = true;

        const { jsPDF } = window.jspdf;
        const formElement = document.getElementById('dataForm');

        try {
            const canvas = await html2canvas(formElement, {
                scale: 1,
                logging: true,
                useCORS: true,
                allowTaint: true
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const pdfBlob = pdf.output('blob');

            const formData = new FormData();
            for (const key in formValues) {
                formData.append(key, formValues[key]);
            }
            formData.append('photos', JSON.stringify(capturedPhotos));
            formData.append('location', JSON.stringify(userLocation));
            formData.append('address', userAddress);
            formData.append('signature', signatureDataUrl);
            formData.append('pdfFile', pdfBlob, 'reporte.pdf');

            console.log("Datos y PDF listos para enviar al servidor.");
            
            // Aquí se realiza la llamada al servidor.
            // Asegúrate de que el servidor esté escuchando en esta dirección
            await fetch('http://localhost:3000/api/send-email', {
                method: 'POST',
                body: formData
            }).then(response => {
                if (response.ok) {
                    alert("¡El correo con el PDF ha sido enviado con éxito!");
                } else {
                    alert("Hubo un error al enviar el correo. Por favor, inténtalo de nuevo.");
                }
            }).catch(error => {
                console.error('Error en la conexión con el servidor:', error);
                alert("Ocurrió un error en la conexión. Asegúrate de que el servidor esté encendido.");
            });

        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
        } finally {
            submitButton.textContent = 'Enviar Datos';
            submitButton.disabled = false;
        }
    });

    startCamera();
    getLocation();
    setupSignatureCanvas();
});