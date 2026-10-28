package com.zcs.sdk;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DriverManager {
    private static DriverManager instance;
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Printer printer;

    private DriverManager() {
        this.printer = Printer.getInstance();
    }

    public static synchronized DriverManager getInstance() {
        if (instance == null) {
            instance = new DriverManager();
        }
        return instance;
    }

    public Printer getPrinter() {
        return printer;
    }

    public ExecutorService getSingleThreadExecutor() {
        return executor;
    }
}
