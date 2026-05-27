require("dotenv").config();

const express = require("express");

const cors = require("cors");

const multer = require("multer");

const axios = require("axios");

const OpenAI = require("openai");

const mongoose = require("mongoose");

const bcrypt = require("bcrypt");

const User = require("./models/User");

/* ================= APP ================= */

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors());

app.use(express.json());

/* ================= MONGODB ================= */

mongoose.connect(
    process.env.MONGO_URI
)
.then(()=>{

    console.log(
        "MongoDB Connected"
    );

})
.catch((error)=>{

    console.log(error);

});

/* ================= MULTER ================= */

const upload = multer();

/* ================= GROQ CLIENT ================= */

const groq = new OpenAI({

    apiKey:
    process.env.GROQ_API_KEY,

    baseURL:
    "https://api.groq.com/openai/v1"

});

/* ================= HOME ================= */

app.get("/", (req,res)=>{

    res.send(
        "SpeakOut Backend Running"
    );

});

/* ================= SIGNUP ================= */

app.post(
    "/signup",

    async (req,res)=>{

    try{

        const {

            name,
            email,
            password

        } = req.body;

        /* CHECK EXISTING */

        const existingUser =
        await User.findOne({

            email

        });

        if(existingUser){

            return res.json({

                message:
                "User already exists"

            });

        }

        /* HASH PASSWORD */

        const hashedPassword =
        await bcrypt.hash(

            password,

            10

        );

        /* CREATE USER */

        const user =
        new User({

            name,

            email,

            password:
            hashedPassword,

            streak:1,

            lastPracticeDate:
            new Date()
            .toDateString()

        });

        /* SAVE */

        await user.save();

        res.json({

            message:
            "Signup successful"

        });

    }

    catch(error){

        console.log(error);

        res.status(500).json({

            message:
            "Signup failed"

        });

    }

});

/* ================= LOGIN ================= */

app.post(
    "/login",

    async (req,res)=>{

    try{

        const {

            email,
            password

        } = req.body;

        /* FIND USER */

        const user =
        await User.findOne({

            email

        });

        if(!user){

            return res.json({

                message:
                "User not found"

            });

        }

        /* CHECK PASSWORD */

        const isMatch =
        await bcrypt.compare(

            password,

            user.password

        );

        if(!isMatch){

            return res.json({

                message:
                "Invalid password"

            });

        }

        res.json({

            message:
            "Login successful",

            name:
            user.name,

            streak:
            user.streak

        });

    }

    catch(error){

        console.log(error);

        res.status(500).json({

            message:
            "Login failed"

        });

    }

});

/* ================= TRANSCRIBE ================= */

app.post(
    "/transcribe",
    upload.single("audio"),

    async (req,res)=>{

    try{

        if(!req.file){

            return res.status(400).json({

                error:
                "No audio uploaded"

            });

        }

        const topic =
        req.body.topic;

        const audioBuffer =
        req.file.buffer;

        /* ================= DEEPGRAM ================= */

        const deepgramResponse =
        await axios.post(

            "https://api.deepgram.com/v1/listen",

            audioBuffer,

            {

                headers:{

                    Authorization:
                    `Token ${process.env.DEEPGRAM_API_KEY}`,

                    "Content-Type":
                    "audio/webm"

                }

            }

        );

        /* ================= TRANSCRIPT ================= */

        const transcript =

        deepgramResponse.data?.results
        ?.channels?.[0]
        ?.alternatives?.[0]
        ?.transcript

        ||

        "";

        if(transcript === ""){

            return res.json({

                transcript:
                "Speech not detected",

                grammar:0,

                fluency:0,

                vocabulary:0,

                confidence:0,

                feedback:
                "Please speak clearly."

            });

        }

        /* ================= GROQ ================= */

        const completion =
        await groq.chat.completions.create({

            model:
            "llama-3.3-70b-versatile",

            messages:[

                {

                    role:"system",

                    content:
                    "You are an AI English communication evaluator."

                },

                {

                    role:"user",

                    content:`

Topic:
${topic}

Transcript:
${transcript}

Evaluate the communication.

Give:
1. Grammar score out of 10
2. Fluency score out of 10
3. Vocabulary score out of 10
4. Confidence score out of 10
5. Professional feedback

Return ONLY JSON.

Example:

{
  "grammar":8,
  "fluency":7,
  "vocabulary":9,
  "confidence":8,
  "feedback":"Good communication and confidence."
}

`

                }

            ]

        });

        const aiText =

        completion.choices[0]
        .message.content;

        const cleanText =

        aiText
        .replace(/```json/g,"")
        .replace(/```/g,"")
        .trim();

        let evaluation;

        try{

            evaluation =
            JSON.parse(cleanText);

        }

        catch(error){

            evaluation = {

                grammar:0,

                fluency:0,

                vocabulary:0,

                confidence:0,

                feedback:
                "AI evaluation parsing failed"

            };

        }

        res.json({

            transcript,

            grammar:
            evaluation.grammar || 0,

            fluency:
            evaluation.fluency || 0,

            vocabulary:
            evaluation.vocabulary || 0,

            confidence:
            evaluation.confidence || 0,

            feedback:
            evaluation.feedback
            ||
            "No feedback"

        });

    }

    catch(error){

        console.log(error);

        res.status(500).json({

            transcript:
            "Transcript not available",

            grammar:0,

            fluency:0,

            vocabulary:0,

            confidence:0,

            feedback:
            "AI evaluation failed"

        });

    }

});

/* ================= INTERVIEW ================= */

app.post(

    "/interview-evaluate",

    upload.single("audio"),

    async (req,res)=>{

    try{

        if(!req.file){

            return res.status(400).json({

                error:
                "No audio uploaded"

            });

        }

        const question =
        req.body.question;

        const audioBuffer =
        req.file.buffer;

        /* ================= DEEPGRAM ================= */

        const deepgramResponse =
        await axios.post(

            "https://api.deepgram.com/v1/listen",

            audioBuffer,

            {

                headers:{

                    Authorization:
                    `Token ${process.env.DEEPGRAM_API_KEY}`,

                    "Content-Type":
                    "audio/webm"

                }

            }

        );

        /* ================= TRANSCRIPT ================= */

        const transcript =

        deepgramResponse.data?.results
        ?.channels?.[0]
        ?.alternatives?.[0]
        ?.transcript

        ||

        "";

        if(transcript === ""){

            return res.json({

                transcript:
                "Speech not detected",

                technical:0,

                communication:0,

                confidence:0,

                problemSolving:0,

                overall:0,

                feedback:
                "Please speak clearly."

            });

        }

        /* ================= GROQ ================= */

        const completion =
        await groq.chat.completions.create({

            model:
            "llama-3.3-70b-versatile",

            messages:[

                {

                    role:"system",

                    content:
                    "You are an AI technical interview evaluator."

                },

                {

                    role:"user",

                    content:`

Question:
${question}

Candidate Answer:
${transcript}

Evaluate the interview answer.

Give:
1. Technical score out of 10
2. Communication score out of 10
3. Confidence score out of 10
4. Problem solving score out of 10
5. Overall score out of 10
6. Professional interview feedback

Return ONLY JSON.

Example:

{
  "technical":8,
  "communication":7,
  "confidence":9,
  "problemSolving":8,
  "overall":8,
  "feedback":"Good technical understanding and confident communication."
}

`

                }

            ]

        });

        const aiText =

        completion.choices[0]
        .message.content;

        const cleanText =

        aiText
        .replace(/```json/g,"")
        .replace(/```/g,"")
        .trim();

        let evaluation;

        try{

            evaluation =
            JSON.parse(cleanText);

        }

        catch(error){

            evaluation = {

                technical:0,

                communication:0,

                confidence:0,

                problemSolving:0,

                overall:0,

                feedback:
                "AI parsing failed"

            };

        }

        res.json({

            transcript,

            technical:
            evaluation.technical || 0,

            communication:
            evaluation.communication || 0,

            confidence:
            evaluation.confidence || 0,

            problemSolving:
            evaluation.problemSolving || 0,

            overall:
            evaluation.overall || 0,

            feedback:
            evaluation.feedback
            ||
            "No feedback"

        });

    }

    catch(error){

        console.log(error);

        res.status(500).json({

            transcript:
            "Transcript unavailable",

            technical:0,

            communication:0,

            confidence:0,

            problemSolving:0,

            overall:0,

            feedback:
            "Interview evaluation failed"

        });

    }

});
/* ================= UPDATE STREAK ================= */

app.post(
    "/update-streak",

    async (req,res)=>{

    try{

        const { email } =
        req.body;

        const user =
        await User.findOne({

            email

        });

        if(!user){

            return res.json({

                message:
                "User not found"

            });

        }

        const today =
        new Date();

        const lastDate =
        new Date(
            user.lastPracticeDate
        );

        const diffTime =
        today - lastDate;

        const diffDays =
        Math.floor(

            diffTime /
            (1000*60*60*24)

        );

        /* SAME DAY */

        if(diffDays === 0){

            return res.json({

                streak:
                user.streak

            });

        }

        /* NEXT DAY */

        if(diffDays === 1){

            user.streak += 1;

        }

        /* MISSED DAYS */

        else{

            user.streak = 1;

        }

        user.lastPracticeDate =
        today.toDateString();

        await user.save();

        res.json({

            streak:
            user.streak

        });

    }

    catch(error){

        console.log(error);

    }

});

/* ================= SERVER ================= */

app.listen(3000, ()=>{

    console.log(
        "Server running on port 3000"
    );

});