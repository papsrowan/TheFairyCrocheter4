package com.zcs.sdk;

import com.zcs.base.SmartPosJni;
import com.zcs.SmartPosSysJni;

public class Printer {
    private static Printer instance;
    private final SmartPosJni baseJni;
    private final SmartPosSysJni sysJni;

    private Printer() {
        this.baseJni = SmartPosJni.createClass();
        this.sysJni = SmartPosSysJni.createClass();
    }

    public static synchronized Printer getInstance() {
        if (instance == null) {
            instance = new Printer();
        }
        return instance;
    }

    public int openBox() {
        android.util.Log.i("POS_DRAWER", "ZCS SDK Printer.openBox() triggered");
        int ret = -1;
        try {
            if (baseJni != null) {
                try {
                    baseJni.sdkDeviceOpen();
                } catch (Throwable ignored) {}
                ret = baseJni.sdkOpenBox();
                android.util.Log.i("POS_DRAWER", "SmartPosJni.sdkOpenBox() ret = " + ret);
            }
        } catch (Throwable t) {
            android.util.Log.e("POS_DRAWER", "Error calling SmartPosJni.sdkOpenBox: " + t.getMessage());
        }

        if (ret != 0) {
            try {
                if (sysJni != null) {
                    try {
                        sysJni.sdkDeviceOpen();
                    } catch (Throwable ignored) {}
                    ret = sysJni.sdkOpenBox();
                    android.util.Log.i("POS_DRAWER", "SmartPosSysJni.sdkOpenBox() ret = " + ret);
                }
            } catch (Throwable t) {
                android.util.Log.e("POS_DRAWER", "Error calling SmartPosSysJni.sdkOpenBox: " + t.getMessage());
            }
        }
        return ret;
    }
}
