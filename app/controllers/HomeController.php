<?php
// HANDAVis/app/controllers/HomeController.php

class HomeController {
    public function render() {
        // This is the Brain telling the server which HTML to show
        $viewFile = __DIR__ . '/../../views/home.php';

        if (file_exists($viewFile)) {
            include $viewFile;
        } else {
            die("Error: View file missing in the views folder.");
        }
    }
}