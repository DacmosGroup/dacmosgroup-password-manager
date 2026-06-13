package co.dacmosgroup.dpm;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DpmKeyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
