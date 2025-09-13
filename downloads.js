function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return view;
}

function writeWavHeader(view, sampleRate, numSamples) {
    const blockAlign = 2; 
    const byteRate = sampleRate * blockAlign;

    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);       
    view.setUint16(20, 1, true);        
    view.setUint16(22, 1, true);        
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);       
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);
}

document.getElementById('downloadWav').addEventListener('click', () => {
    if (!pcm) return alert('No PCM loaded!');
    const numSamples = pcm.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    writeWavHeader(view, sampleRate, numSamples);

    const pcm16 = floatTo16BitPCM(pcm);
    for (let i = 0; i < pcm16.byteLength; i++) {
        view.setUint8(44 + i, pcm16.getUint8(i));
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.wav';
    a.click();
    URL.revokeObjectURL(url);
});
document.getElementById('downloadButton').addEventListener('click', function() {
    let oil = iLow; oih = iHigh; ofl = fLow; ofh = fHigh;
    iLow = 0; iHigh = framesTotal; fLow = 0; fHigh = sampleRate/2; updateCanvasScroll();
    let canvasUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = canvasUrl;
    downloadLink.download = 'my-drawing.png';
    downloadLink.click();
    downloadLink.remove();
    iLow = oil; iHigh = oih; fLow = ofl; fHigh = ofh;
});