import { createTheme } from "@mui/material/styles";

export const desktopTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#fcfcfb",
      paper: "#ffffff"
    },
    primary: {
      main: "#5f968d",
      contrastText: "#ffffff"
    },
    secondary: {
      main: "#eef3f1",
      contrastText: "#262826"
    },
    error: {
      main: "#b86d67",
      contrastText: "#ffffff"
    },
    text: {
      primary: "#262826",
      secondary: "#66706a"
    },
    divider: "#d6d9d4"
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily:
      '"Pretendard Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Noto Sans KR", "Helvetica Neue", Arial, sans-serif',
    button: {
      textTransform: "none",
      letterSpacing: 0
    },
    allVariants: {
      letterSpacing: 0
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          minWidth: 0,
          borderRadius: 8,
          fontWeight: 600
        }
      }
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#c2c6c1 transparent"
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
});
