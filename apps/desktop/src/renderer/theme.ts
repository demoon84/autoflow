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
    fontSize: 13,
    h1: {
      fontSize: "1.375rem",
      lineHeight: 1.12
    },
    h2: {
      fontSize: "1.125rem",
      lineHeight: 1.18
    },
    h3: {
      fontSize: "1rem",
      lineHeight: 1.2
    },
    h4: {
      fontSize: "0.9375rem",
      lineHeight: 1.25
    },
    h5: {
      fontSize: "0.875rem",
      lineHeight: 1.3
    },
    h6: {
      fontSize: "0.8125rem",
      lineHeight: 1.35
    },
    subtitle1: {
      fontSize: "0.875rem",
      lineHeight: 1.35
    },
    subtitle2: {
      fontSize: "0.8125rem",
      lineHeight: 1.35
    },
    body1: {
      fontSize: "0.8125rem",
      lineHeight: 1.45
    },
    body2: {
      fontSize: "0.75rem",
      lineHeight: 1.4
    },
    button: {
      fontSize: "0.75rem",
      lineHeight: 1.25,
      textTransform: "none",
      letterSpacing: 0
    },
    caption: {
      fontSize: "0.6875rem",
      lineHeight: 1.35
    },
    overline: {
      fontSize: "0.6875rem",
      lineHeight: 1.35
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
          fontSize: "0.75rem",
          fontWeight: 600
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: "0.71875rem"
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
          borderRadius: 8,
          fontSize: "0.8125rem"
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.75rem"
        }
      }
    }
  }
});
