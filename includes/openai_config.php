<?php
return [
    'api_key' => getenv('OPENAI_API_KEY') ?: 'paste_your_openai_api_key_here',
    'model' => getenv('HANDAM_OPENAI_MODEL') ?: 'gpt-5.4',
];
