class PhotoCam extends BaseComponent {
    tagName() {
        return 'photocam';
    }

    componentId = this.getId();

    getCssDependencies() {
        return [];
    }

    getJsDependencies() {
        return [];
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const mainParent = document.createElement('kc-photo-camera');
        // Stream video via webcam
        const vidWrap = document.createElement('div');
        vidWrap.className = 'video-wrap';
        const videoTag = document.createElement('video');
        videoTag.id = 'video';
        videoTag.setAttribute('playsinline', 'true');
        videoTag.setAttribute('autoplay', 'true');
        vidWrap.appendChild(videoTag);

        // Trigger canvas web API
        const contDiv = document.createElement('div');
        contDiv.className = 'controller';
        const contButton = document.createElement('button');
        contButton.id = 'snap';
        contButton.textContent = 'Capture';
        contDiv.appendChild(contButton);

        // Webcam video snapshot
        const canV = document.createElement('canvas');
        canV.id = 'canvas';
        canV.setAttribute('width', '400');
        canV.setAttribute('height', '300');

        mainParent.append(vidWrap);
        mainParent.append(contDiv);
        mainParent.append(canV);
        node.append(mainParent);

        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const snap = document.getElementById('snap');
        const errorMsgElement = document.querySelector('span#errorMsg');
        const constraints = {
            audio: false,
            video: {
                width: 600, height: 400,
            },
        };

        // Success
        function handleSuccess(stream) {
            window.stream = stream;
            video.srcObject = stream;
        }

        // Access webcam
        async function init() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                handleSuccess(stream);
            } catch (e) {
                errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
            }
        }

        // Load init
        init();
        this.isRendered(this.getComponentId());

        // Draw image
        const context = canvas.getContext('2d');
        snap.addEventListener('click', () => {
            context.drawImage(video, 0, 0, 400, 300);
            const image = canV.toDataURL('img/jpeg');
            console.log(image);
        });
    }
}

module.exports = PhotoCam;
