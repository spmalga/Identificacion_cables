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

    function resizeImage(img, maxWidth, maxHeight) {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

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
    
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempContext = tempCanvas.getContext('2d');
        tempContext.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        const photoDataUrl = tempCanvas.toDataURL('image/png');
        
        const img = new Image();
        img.onload = () => {
            const newPhotoDataUrl = resizeImage(img, 600, 600);
            
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
        };
        img.src = photoDataUrl;
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

            const formData = new FormData(formElement);
            formData.append('pdfFile', pdfBlob, 'reporte.pdf');
            
            const signatureBlob = dataURLtoBlob(signatureDataUrl);
            formData.append('signature', signatureBlob, 'firma.png');
            
            capturedPhotos.forEach((photo, index) => {
                const photoBlob = dataURLtoBlob(photo);
                formData.append(`photo_${index + 1}`, photoBlob, `foto_${index + 1}.png`);
            });
            
            formData.append('location', `Lat: ${userLocation.latitude}, Lon: ${userLocation.longitude}`);
            formData.append('address', userAddress);
            formData.append('workReference', document.getElementById('workReference').value);
            formData.append('cableDescription', document.getElementById('cableDescription').value);
            formData.append('chainDescription', document.getElementById('chainDescription').value);
            formData.append('markedDescription', document.getElementById('markedDescription').value);
            formData.append('fullName', document.getElementById('fullName').value);
            formData.append('company', document.getElementById('company').value);
            formData.append('equipment', document.getElementById('equipment').value);
            formData.append('date', document.getElementById('date').value);

            formElement.submit();

        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
        } finally {
            submitButton.textContent = 'Enviar Datos';
            submitButton.disabled = false;
        }
    });

    function dataURLtoBlob(dataurl) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type: mime});
    }
    
    startCamera();
    getLocation();
    setupSignatureCanvas();
});