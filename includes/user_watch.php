<?php
require_once __DIR__ . '/../database/db_connection.php'; 

if (!isset($conn)) {
    die("Database connection variable not found.");
}

$videos = [];

$sql = "SELECT * FROM disaster_videos ORDER BY created_at DESC";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $videos[] = $row;
    }
}
$activePage = 'watchPage';
?>
<section id="watchPage" class="page" style="display: none;">
    
    <div class="topbar">
        <div class="page-head">
            <h1>Disaster Preparedness Watch</h1>
            <p>Live educational feed for Western Visayas.</p>
        </div>
        <div class="category-filter">
            <button class="filter-btn active" onclick="filterVideos('all', event)">All</button>
            <button class="filter-btn" onclick="filterVideos('earthquake', event)">Earthquake</button>
            <button class="filter-btn" onclick="filterVideos('flood', event)">Flood</button>
            <button class="filter-btn" onclick="filterVideos('volcano', event)">Volcano</button>
            <button class="filter-btn" onclick="filterVideos('fire', event)">Fire</button>
        </div>
    </div>

    <div class="video-grid">
        <?php if (!empty($videos)): ?>
            <?php foreach ($videos as $v): ?>
                <div class="video-card" data-category="<?= htmlspecialchars($v['category']) ?>">
                    <div class="video-thumb">
                        <img src="https://img.youtube.com/vi/<?= htmlspecialchars($v['youtube_id']) ?>/mqdefault.jpg" alt="Video">
                        <div class="play-overlay" onclick="openVideoPlayer('<?= htmlspecialchars($v['youtube_id']) ?>')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                    <div class="video-info">
                        <span class="video-tag tag-<?= htmlspecialchars($v['category']) ?>"><?= ucfirst(htmlspecialchars($v['category'])) ?></span>
                        <h3><?= htmlspecialchars($v['video_title']) ?></h3>
                        <p><?= htmlspecialchars($v['description']) ?></p>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <p>No preparedness videos available.</p>
            </div>
        <?php endif; ?>
    </div>

    <div id="videoModal" class="video-modal" onclick="if(event.target===this) closeVideoPlayer()">
        <div class="video-modal-content">
            <button class="close-video" onclick="closeVideoPlayer()">×</button>
            <div class="video-container">
                <div id="playerFrame"></div>
            </div>
        </div>
    </div>

</section>