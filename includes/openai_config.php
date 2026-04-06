<?php
return [
    // Safe to commit: keep the real key in OPENAI_API_KEY or in includes/openai_config.local.php only.
    // OpenAI API Key for HANDAm is not sent, as this will compromise and disable the API key.
    'api_key' => getenv('OPENAI_API_KEY') ?: 'paste_your_openai_api_key_here',
    'model' => getenv('HANDAM_OPENAI_MODEL') ?: 'gpt-5.4',
];
