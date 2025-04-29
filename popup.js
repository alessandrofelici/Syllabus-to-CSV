import apiKeys from "./hidden.js";
const mistralApiKey =  apiKeys.mistralApiKey;
const geminiApiKey = apiKeys.geminiApiKey;

document.getElementById('file-upload').addEventListener('change', async () => {
    // Get fileUploaded, returns object at index 0
    const fileUploaded = event.target.files.item(0);
    if (fileUploaded == null) {
        return;
    }

    // Create form object for PDF send to OCR API
    const form = new FormData();
    form.append('purpose', 'ocr');
    form.append('file', new File([fileUploaded], `${fileUploaded.name}`));

    // Send to Mistral and get structured markdown
    let ocrJson = await PDFToJson(form);

    // Combine all markdown content into one string
    let text = "";
    for (const page of ocrJson.pages) {
        text += page.markdown + "\n";
    }
    // DEBUG console.log(text);

    // Send combined markdown to Gemini for CSV generation
    const geminiJson = await JsonToCSV(text);
    const geminiResponse = geminiJson.candidates[0].content.parts[0].text;

    // Download the result as a .csv file
    createFileAndDownload("downloadable.csv", geminiResponse.slice(6).slice(0, -3));
});

/**
     * Convert a PDF to a JSON object
     * 
     * @param {FormData} form
     * @returns {Promise<Object>}
     */
async function PDFToJson(form) {
    const uploadedPDF = await fetch('https://api.mistral.ai/v1/files', {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${mistralApiKey}`
        },
        body: form,
    });

    const PDFJson = await uploadedPDF.json();

    // Task 1 (get url):
    const getPDF = await fetch('https://api.mistral.ai/v1/files/' + PDFJson.id + '/url?expiry=24', {
        method: 'GET',
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${mistralApiKey}`
        },
    });

    const responseJSON = await getPDF.json();
    // DEBUG console.log(responseJSON.url);

    // Task 2:
    const jsonURL = JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
            type: "document_url",
            document_url: `${responseJSON.url}`
        },
        include_image_base64: true
    });

    const ocrJson = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mistralApiKey}`
        },
        body: jsonURL,
    });

    return await ocrJson.json();
}

// Task 3
/**
 * Convert a JSON object to a CSV file
 * 
 * @param {string} markdownExport
 * @returns {Promise<Object>}
 */
async function JsonToCSV(markdownExport) {

    const geminiPOST = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST', 
        headers:{
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: `Here's a syllabus in Markdown. Can you pull out the assignments and return them in a neat table? I need this in a CSV format with columns for the due date, class, assignment name, assignment type (from: Homework, Reading, Project, Exam), and checkbox.\n\n${markdownExport}`
                        }
                    ]
                }
            ]
        })
    });

    return await geminiPOST.json();
}

/**
 * Convert a PDF to a JSON object
 * 
 * @param {filename} filename
 * @param {content} content
 * @returns {Promise<Object>}
 */
function createFileAndDownload(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    const p = document.createElement('p');
    p.innerHTML = filename;
    link.append(p);
}