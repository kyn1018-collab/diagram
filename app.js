const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const questionCanvas = document.getElementById('question-canvas');
const qCtx = questionCanvas.getContext('2d');

const ui = {
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    questionBoard: document.getElementById('question-board'),
    scoreEl: document.getElementById('score'),
    livesEl: document.getElementById('lives'),
    finalScoreEl: document.getElementById('final-score'),
    questionText: document.getElementById('question-text'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn')
};

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let lives = 3;
let speed = 1.5;
let lanes = [0, 0, 0]; // X positions of lanes
let laneWidth = 0;
let playerLane = 1; // 0: Left, 1: Middle, 2: Right

let currentQuestion = null;
let currentObstacle = null;
let roadY = 0;

let lastTime = 0;
let animationId;

// Shapes Definition
const SHAPES = [
    function drawP(ctx) {
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(-10, 20);
        ctx.moveTo(-10, -20);
        ctx.lineTo(10, -20);
        ctx.arc(10, -10, 10, -Math.PI/2, Math.PI/2);
        ctx.lineTo(-10, 0);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();
    },
    function drawTriangle(ctx) {
        ctx.beginPath();
        ctx.moveTo(-15, 15);
        ctx.lineTo(15, 15);
        ctx.lineTo(-15, -15);
        ctx.closePath();
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
    },
    function drawF(ctx) {
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(-10, 20);
        ctx.moveTo(-10, -20);
        ctx.lineTo(10, -20);
        ctx.moveTo(-10, 0);
        ctx.lineTo(5, 0);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();
    },
    function drawArrow(ctx) {
        ctx.beginPath();
        ctx.moveTo(-15, -5);
        ctx.lineTo(5, -5);
        ctx.lineTo(5, -15);
        ctx.lineTo(20, 0);
        ctx.lineTo(5, 15);
        ctx.lineTo(5, 5);
        ctx.lineTo(-15, 5);
        ctx.closePath();
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
    },
    function drawL(ctx) {
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(-10, 20);
        ctx.lineTo(15, 20);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();
    },
    function drawFlag(ctx) {
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(-10, 20);
        ctx.moveTo(-10, -20);
        ctx.lineTo(15, -10);
        ctx.lineTo(-10, 0);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
    },
    function drawZ(ctx) {
        ctx.beginPath();
        ctx.moveTo(-15, -15);
        ctx.lineTo(15, -15);
        ctx.lineTo(-15, 15);
        ctx.lineTo(15, 15);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();
    },
    function drawNumber7(ctx) {
        ctx.beginPath();
        ctx.moveTo(-10, -15);
        ctx.lineTo(10, -15);
        ctx.lineTo(-5, 15);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();
    },
    function drawHouse(ctx) {
        ctx.beginPath();
        ctx.moveTo(-15, 15);
        ctx.lineTo(15, 15);
        ctx.lineTo(15, -5);
        ctx.lineTo(0, -15);
        ctx.lineTo(-15, -5);
        ctx.closePath();
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
        // 굴뚝 추가 (비대칭으로 만들기 위해)
        ctx.beginPath();
        ctx.moveTo(8, -10);
        ctx.lineTo(8, -18);
        ctx.lineTo(12, -18);
        ctx.lineTo(12, -7);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
    }
];

const TRANSFORMS = [
    { name: '오른쪽(왼쪽)으로 뒤집기', action: (c) => c.scale(-1, 1), isFlip: true },
    { name: '위(아래)쪽으로 뒤집기', action: (c) => c.scale(1, -1), isFlip: true },
    { name: '시계 방향으로 90도 돌리기', action: (c) => c.rotate(Math.PI / 2), isFlip: false },
    { name: '반시계 방향으로 90도 돌리기', action: (c) => c.rotate(-Math.PI / 2), isFlip: false },
    { name: '180도 돌리기', action: (c) => c.rotate(Math.PI), isFlip: false }
];

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    laneWidth = canvas.width / 3;
    lanes = [laneWidth * 0.5, laneWidth * 1.5, laneWidth * 2.5];
}
window.addEventListener('resize', resize);
resize();

// Input
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if(e.touches.length > 0) handleInput(e.touches[0]);
}, {passive: false});

function handleInput(e) {
    if (gameState !== 'PLAYING') return;
    const x = e.clientX || e.pageX;
    if (x < laneWidth) playerLane = 0;
    else if (x < laneWidth * 2) playerLane = 1;
    else playerLane = 2;
}

ui.startBtn.addEventListener('click', startGame);
ui.restartBtn.addEventListener('click', startGame);

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    lives = 3;
    speed = 1.5;
    playerLane = 1;
    currentObstacle = null;
    
    updateHUD();
    ui.startScreen.classList.add('hidden');
    ui.gameOverScreen.classList.add('hidden');
    ui.questionBoard.classList.remove('hidden');
    
    generateQuestion();
    
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    gameLoop(lastTime);
}

function generateQuestion() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const transform = TRANSFORMS[Math.floor(Math.random() * TRANSFORMS.length)];
    
    currentQuestion = { shape, transform };
    
    // Draw on question canvas
    qCtx.clearRect(0, 0, 100, 100);
    qCtx.save();
    qCtx.translate(50, 50);
    qCtx.scale(1.5, 1.5);
    // Draw original shape with some color
    qCtx.strokeStyle = '#2c3e50';
    qCtx.fillStyle = '#2c3e50';
    shape(qCtx);
    qCtx.restore();
    
    ui.questionText.innerText = transform.name;
    
    // Generate answers
    const correctLane = Math.floor(Math.random() * 3);
    const options = [];
    
    for (let i = 0; i < 3; i++) {
        if (i === correctLane) {
            options.push(transform);
        } else {
            // Pick a random wrong transform
            let wrongTransform;
            do {
                wrongTransform = TRANSFORMS[Math.floor(Math.random() * TRANSFORMS.length)];
            } while (wrongTransform.name === transform.name);
            
            // To make it harder, if it's not a flip, we might add a fake flip
            if(Math.random() > 0.5) {
                options.push(wrongTransform);
            } else {
                // Return original shape or something else to act as a trap
                options.push({ name: 'wrong', action: (c) => c.scale(1,1) }); 
            }
        }
    }
    
    currentObstacle = {
        y: -100,
        options: options,
        correctLane: correctLane,
        shape: shape
    };
}

function updateHUD() {
    ui.scoreEl.innerText = score;
    ui.livesEl.innerText = lives;
}

function drawCar(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    // Car body
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(-20, -35, 40, 70, 10);
    ctx.fill();
    // Windows
    ctx.fillStyle = '#34495e';
    ctx.fillRect(-15, -15, 30, 20);
    ctx.fillRect(-15, 15, 30, 10);
    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-25, -25, 5, 15);
    ctx.fillRect(20, -25, 5, 15);
    ctx.fillRect(-25, 15, 5, 15);
    ctx.fillRect(20, 15, 5, 15);
    ctx.restore();
}

function drawRoad() {
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Road markers
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 5;
    ctx.setLineDash([40, 40]);
    
    roadY = (roadY + speed) % 80;
    
    ctx.beginPath();
    ctx.moveTo(laneWidth, -80 + roadY);
    ctx.lineTo(laneWidth, canvas.height);
    ctx.moveTo(laneWidth * 2, -80 + roadY);
    ctx.lineTo(laneWidth * 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

function gameLoop(time) {
    if (gameState !== 'PLAYING') return;
    const dt = time - lastTime;
    lastTime = time;
    
    // Update
    if (currentObstacle) {
        currentObstacle.y += speed;
        
        // Collision check
        const carY = canvas.height - 100;
        if (currentObstacle.y > carY - 40 && currentObstacle.y < carY + 40) {
            if (playerLane === currentObstacle.correctLane) {
                // Correct
                score += 10;
                speed = Math.min(speed + 0.2, 8);
            } else {
                // Wrong
                lives--;
                // Visual feedback for wrong (red flash)
                ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            updateHUD();
            
            if (lives <= 0) {
                gameOver();
                return;
            }
            currentObstacle = null;
            setTimeout(generateQuestion, 500);
        } else if (currentObstacle.y > canvas.height + 100) {
            // Missed? (shouldn't happen as collision is always checked)
            currentObstacle = null;
            generateQuestion();
        }
    }
    
    // Draw
    drawRoad();
    
    if (currentObstacle) {
        for (let i = 0; i < 3; i++) {
            const laneX = lanes[i];
            
            // Draw box
            ctx.fillStyle = i === currentObstacle.correctLane ? '#f39c12' : '#95a5a6';
            ctx.fillStyle = '#8e44ad'; // hide answer correctness
            ctx.beginPath();
            ctx.arc(laneX, currentObstacle.y, 40, 0, Math.PI*2);
            ctx.fill();
            
            ctx.save();
            ctx.translate(laneX, currentObstacle.y);
            ctx.scale(2, 2);
            currentObstacle.options[i].action(ctx);
            
            // Draw shape
            currentObstacle.shape(ctx);
            ctx.restore();
        }
    }
    
    drawCar(ctx, lanes[playerLane], canvas.height - 100);
    
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'GAMEOVER';
    ui.questionBoard.classList.add('hidden');
    ui.gameOverScreen.classList.remove('hidden');
    ui.finalScoreEl.innerText = score;
}
